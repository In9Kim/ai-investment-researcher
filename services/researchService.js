// services/researchService.js
// Phase 2: 4인 AI 에이전트 멀티 분석 파이프라인
// 흐름: 뉴스 수집 → 에이전트 병렬 분석 → HTML 포스팅 생성 → Google Sheets 저장 → 텔레그램 알림

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { appendResearchRow } = require('../lib/googleSheets');
const { fetchLatestHeadlines, formatHeadlinesForAI } = require('./newsService');
const { sendTelegramNotification } = require('./telegramService');

// ── Gemini 클라이언트 ─────────────────────────────────────────

// 호출 시점에 생성하여 환경 변수 로딩을 보장
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
}

// ── Agent Personas (agents.md 기반) ──────────────────────────

const AGENT_PROMPTS = {
  agentA_macro: `
당신은 연준(Fed)에서 20년간 일했던 거시경제 분석가예요.
지금은 개인 투자자들에게 "돈의 흐름"을 알려주는 역할을 하고 있어요.
금리, CPI, 고용 지표가 유동성에 어떤 영향을 주는지, 마치 친한 선배가 설명해주듯 이야기하세요.

말투 규칙:
- ~해요, ~이죠, ~거든요 같은 구어체를 섞어 친근하게
- 전문 용어는 쓰되 반드시 한 줄 설명을 붙여주세요
- 독자에게 직접 말하는 느낌으로 ("여러분", "지금 이게 왜 중요하냐면요")

다음 뉴스 헤드라인을 당신의 관점에서 3~4문장으로 분석하세요.
`.trim(),

  agentB_technical: `
당신은 오직 숫자와 차트만 믿는 냉정한 퀀트 트레이더예요.
감정은 없어요. 오직 이동평균선, RSI, MACD, 볼린저 밴드만 말해줘요.
"차트가 말해주는 것"을 마치 주식 방송 MC처럼 생동감 있게 전달하세요.

말투 규칙:
- 단호하고 빠른 문장 ("지금 RSI 보면요, 딱 과매수예요")
- 구체적인 수치와 레벨을 반드시 포함 (예: "200일선 $XXX 붕괴 여부가 관건")
- 확신에 찬 어조, 하지만 가끔 "이건 제 뇌피셜입니다" 같은 솔직함도 섞어주세요

다음 뉴스 헤드라인이 기술적 지표에 미치는 영향을 3~4문장으로 분석하세요.
`.trim(),

  agentC_fundamental: `
당신은 워런 버핏을 존경하는 가치투자 펀드매니저예요.
기업의 진짜 실력, 즉 이익과 해자(Moat)로 판단하고 장기적 시각을 갖고 있어요.
투자 초보자도 이해할 수 있도록 비유를 들어가며 설명해주세요.

말투 규칙:
- 따뜻하고 설득력 있는 어조 ("이렇게 생각해보세요", "장기적으로 보면요")
- EPS, PER 같은 수치는 반드시 언급하되, "이게 비싼 건지 싼 건지"로 해석해줄 것
- 투자 결정에 도움이 되는 구체적인 포인트를 콕 집어주세요

다음 뉴스 헤드라인을 기업 펀더멘털 관점에서 3~4문장으로 분석하세요.
`.trim(),

  // Why: Risk 에이전트는 낙관 편향에 빠진 독자를 흔들어 깨우는 역할 → 의도적으로 직설적·공포감 있게 설정
  agentD_risk: `
당신은 월가에서 가장 무서운 리스크 매니저예요.
모두가 "오른다"고 할 때 혼자 "잠깐만요, 이거 아시나요?"라고 말하는 사람이죠.
지금 시장에서 사람들이 외면하는 최악의 시나리오를 날카롭게 경고하세요.

말투 규칙:
- 직설적이고 다소 무섭게 ("이거 진짜 위험합니다", "모르면 물립니다")
- 구체적인 위기 시나리오를 숫자와 함께 제시 ("만약 ~라면 -XX% 급락 가능")
- 독자가 긴장하게 만들되, 마지막엔 "그래서 이것만은 확인하세요"로 마무리
- 상투적인 위험 나열 금지. 지금 이 뉴스에서 나올 수 있는 구체적 위험만 경고할 것

다음 뉴스 헤드라인에서 숨겨진 리스크를 3~4문장으로 경고하세요.
`.trim(),
};

// Why: HTML 출력으로 전환 — 티스토리 직접 붙여넣기를 위해 마크다운 제거
// [TITLE]/[SUMMARY]/[HTML] 구분자 방식 — HTML을 JSON에 임베드하면 이스케이프 오류가 빈번하므로 구분자 파싱 채택
// 제목 자동 선정: 3개 후보 대신 Gemini가 분석 내용 기반으로 최적 1개를 직접 결정
const COORDINATOR_PROMPT = `
당신은 미국 주식 전문 블로그 작가입니다. 매일 수만 명이 읽는 "투자자를 위한 데일리 모닝 브리핑" 블로그를 운영하고 있습니다.
아래 4인 전문가의 토론을 바탕으로 내일 아침 투자자가 읽을 데일리 리포트를 작성하세요.

글의 시점: 오늘 저녁 작성되지만, 내일 아침 출근 전 투자자가 읽는 브리핑 형식으로 작성합니다.
말투: 전문적이되 친근한 구어체 (~해요, ~이죠, ~거든요), 독자에게 직접 말하는 느낌으로.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 형식 — 아래 구분자를 정확히 사용할 것]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[TITLE]
(클릭율이 가장 높을 제목 1개만. 규칙: 숫자 OR 반전 포인트 OR 긴급 키워드 중 하나 포함 + 이모지 1개)
[/TITLE]

[SUMMARY]
🔴 (리스크 한 줄 — 가장 날카로운 위험 신호)
🟡 (주의 한 줄 — 중립적 관찰 포인트)
🟢 (기회 한 줄 — 가장 긍정적인 투자 신호)
[/SUMMARY]

[HTML]
<h2>📰 오늘 시장을 흔든 이슈</h2>
<p>(핵심 뉴스 서론 2~3문장. 왜 지금 이 이슈가 중요한지 독자의 관심을 잡을 것)</p>

<h2>🗣️ 전문가 4인의 긴급 단톡방 🔥</h2>
<blockquote><strong>💰 매크로 분석가</strong><br>"(agentA 핵심 인사이트 1~2문장 대화체)"</blockquote>
<blockquote><strong>📊 퀀트 트레이더</strong><br>"(agentB 핵심 인사이트 1~2문장 대화체)"</blockquote>
<blockquote><strong>🏢 펀드매니저</strong><br>"(agentC 핵심 인사이트 1~2문장 대화체)"</blockquote>
<blockquote><strong>⚠️ 리스크 매니저</strong><br>"(agentD 핵심 경고 1~2문장, 가장 날카롭게)"</blockquote>

<h2>🎯 종합 투자 인사이트</h2>
<p>(4인 의견 종합 결론. 300~400자. SEO 키워드 자연스럽게 포함: 미국 주식, 나스닥, S&P500, 서학개미, ETF)</p>

<h2>📊 오늘의 투자 매력도 점수</h2>
<table><thead><tr><th>항목</th><th>평가</th><th>점수</th></tr></thead><tbody>
<tr><td>🌍 매크로 환경</td><td>(한 줄 근거)</td><td>(⭐ 1~5개 실제 계산)</td></tr>
<tr><td>📈 기술적 신호</td><td>(한 줄 근거)</td><td>(⭐ 1~5개 실제 계산)</td></tr>
<tr><td>💼 펀더멘털</td><td>(한 줄 근거)</td><td>(⭐ 1~5개 실제 계산)</td></tr>
<tr><td>🚨 리스크 수준</td><td>(한 줄 근거)</td><td>(⭐ 1~5개 실제 계산)</td></tr>
<tr><td><strong>🏆 종합</strong></td><td></td><td><strong>★★★☆☆ (X.X / 5.0)</strong></td></tr>
</tbody></table>

<h2>⏰ 내일 아침, 딱 하나만 확인하세요</h2>
<blockquote><strong>(지표명 또는 이벤트명)</strong>: (왜 내일의 핵심인지 2문장. 구체적 수치 기준 포함)</blockquote>

<p><em>※ 본 포스팅은 AI 멀티에이전트 리서치 시스템이 생성한 투자 참고 자료이며, 투자 결정의 최종 책임은 본인에게 있습니다.</em></p>
[/HTML]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[HTML 작성 규칙]
- [HTML] 블록 안에는 순수 HTML 태그만 사용, 마크다운(#, *, >, ---) 절대 금지
- 이모지는 <h2> 태그 섹션 제목에만 사용, 본문 내 남용 금지
- "성공 투자 기원합니다" 같은 상투적 마무리 절대 금지
- 총 텍스트 분량: 900~1200자 (HTML 태그 제외 기준)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[4인 전문가 토론 원문]
`.trim();

// ── Private: 키워드 자동 추출 ────────────────────────────────

// Why: 단순 키워드 빈도 추출은 지정학적 리스크처럼 언급 빈도는 낮지만
//      시장 충격이 큰 뉴스를 놓침 → 우선순위 기반 가중치 필터링으로 보완
const KEYWORD_EXTRACTION_PROMPT = `
당신은 월스트리트 헤지펀드의 수석 리서치 편집장이에요.
오늘 수집된 뉴스를 분석해서 미국 증시에 가장 큰 영향을 줄 핵심을 뽑아야 해요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 1] 우선순위(Priority) 기반 뉴스 필터링
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

헤드라인을 읽으면서 아래 우선순위 순서대로 가장 높은 등급에 해당하는 뉴스를 찾으세요.

🔴 P1 — 지정학적 리스크 / 에너지 충격 (최우선)
  감지 트리거: 전쟁, 분쟁, 침공, 공습, 제재, 수출 규제, 봉쇄, 유가(WTI/브렌트) 급변, OPEC 결정, 가스 공급 차질
  → 이 트리거 중 하나라도 발견되면 geopoliticalRiskLevel = "HIGH"

🟠 P2 — 거시경제 핵심 이벤트 (높음)
  감지 트리거: Fed 발언/결정, CPI 발표, 고용지표 충격, 국채 금리 급등, 경기침체 공식화
  → P1 없을 때 geopoliticalRiskLevel = "MEDIUM"

🟡 P3 — 빅테크/반도체/AI 섹터 이슈 (중간)
  감지 트리거: 실적 발표, 가이던스 수정, AI 투자 발표, 반도체 공급망 변화
  → P1·P2 없을 때 geopoliticalRiskLevel = "LOW"

⚪ P4 — 개별 종목 이슈 (기본)
  → geopoliticalRiskLevel = "NONE"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 2] 상관관계(Correlation) 분석 — 미국 기술주에 미칠 파급 효과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

P1 뉴스가 탐지된 경우, 아래 연쇄 충격 경로를 따라 keywords를 구성하세요.

경로 A — 전쟁/제재/수출 규제 탐지 시:
  지정학 이슈 → 반도체 수출 통제 강화 가능성 → NVDA, AMD, ASML, TSMC 리스크
  → keywords에 해당 종목 + "반도체 수출 규제" 반드시 포함

경로 B — 유가/에너지 충격 탐지 시:
  유가 급등 → 인플레이션 재발 우려 → Fed 금리 동결/인상 시나리오 부활 → 나스닥 밸류에이션 압박
  → keywords에 "WTI유가", "CPI", "금리 동결" 반드시 포함

경로 C — 분쟁 지역이 반도체 공급망과 직결될 때 (예: 대만 해협, 한반도):
  공급망 붕괴 리스크 → 전 세계 반도체 부족 재현 가능성
  → keywords에 "공급망 리스크", "TSMC", "삼성전자" 포함

P1 없는 경우: 뉴스에서 직접 언급된 종목·지표 중심으로 keywords 구성

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[STEP 3] 카테고리 동적 매핑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

geopoliticalRiskLevel에 따라 category를 아래 규칙으로 결정하세요.

HIGH + 반도체 수출 규제 연관  → "지정학/반도체"
HIGH + 에너지(유가/가스) 중심 → "에너지/매크로"
HIGH + 기타 지정학             → "매크로/지정학"
MEDIUM                         → "매크로/금리"
LOW + AI/반도체 중심           → "AI반도체"
LOW + 빅테크 중심              → "빅테크"
LOW + 전기차 중심              → "전기차/에너지"
LOW + 바이오 중심              → "바이오/헬스케어"
NONE                           → 뉴스에서 가장 많이 언급된 섹터명

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 형식 — JSON만 반환. 코드블록('''), 부가 설명 절대 금지]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "geopoliticalRiskLevel": "HIGH | MEDIUM | LOW | NONE",
  "category": "STEP 3 규칙으로 결정된 카테고리",
  "keywords": "STEP 2 상관관계 경로에 따라 결정된 핵심 종목·지표 4~6개 (쉼표 구분)",
  "selectedHeadlines": "분석 가치가 가장 높은 헤드라인 5개를 줄바꿈(\\n)으로 구분한 문자열. 번호·기호 없이 텍스트만.",
  "reason": "선택한 카테고리와 키워드의 근거 — 어떤 상관관계 경로를 적용했는지 한 문장으로"
}

[오늘 수집된 헤드라인]
`.trim();

/**
 * Gemini가 JSON을 markdown 코드블록으로 감싸는 경우를 대비한 정제 함수
 * Why: Gemini는 종종 ```json ... ``` 형태로 응답하여 JSON.parse()가 실패함
 */
function extractJsonFromGeminiResponse(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

const RISK_LEVEL_EMOJI = { HIGH: '🔴', MEDIUM: '🟠', LOW: '🟡', NONE: '⚪' };

/**
 * Coordinator 응답에서 제목·요약·HTML 본문을 구분자 기반으로 파싱
 * Why: HTML을 JSON에 임베드하면 이스케이프 오류가 빈번 → [TITLE]/[SUMMARY]/[HTML] 구분자 방식 채택
 */
function parseFinalPostResponse(rawText) {
  const titleMatch = rawText.match(/\[TITLE\]([\s\S]*?)\[\/TITLE\]/);
  const summaryMatch = rawText.match(/\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/);
  const htmlMatch = rawText.match(/\[HTML\]([\s\S]*?)\[\/HTML\]/);

  if (!titleMatch || !summaryMatch || !htmlMatch) {
    throw new Error(
      `포스팅 파싱 실패 — 응답에서 구분자([TITLE], [SUMMARY], [HTML])를 찾을 수 없음.\n응답 앞부분:\n${rawText.slice(0, 500)}`
    );
  }

  return {
    title: titleMatch[1].trim(),
    summary: summaryMatch[1].trim(),
    htmlContent: htmlMatch[1].trim(),
  };
}

/**
 * 수집된 헤드라인에서 오늘의 카테고리·키워드·대표 뉴스를 자동 추출
 * 지정학적 리스크 수준에 따라 카테고리·키워드를 동적으로 결정
 *
 * @param {Object} model     - Gemini 모델 인스턴스
 * @param {Array}  headlines - fetchLatestHeadlines 반환값
 * @returns {Promise<{geopoliticalRiskLevel, category, keywords, selectedHeadlines, reason}>}
 */
async function extractTodayKeywords(model, headlines) {
  const headlineText = formatHeadlinesForAI(headlines.slice(0, 30));
  const prompt = `${KEYWORD_EXTRACTION_PROMPT}\n\n${headlineText}`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();

  let parsed;
  try {
    parsed = extractJsonFromGeminiResponse(rawText);
  } catch {
    throw new Error(`키워드 추출 JSON 파싱 실패. Gemini 응답:\n${rawText}`);
  }

  const riskLevel = parsed.geopoliticalRiskLevel ?? 'NONE';
  const emoji = RISK_LEVEL_EMOJI[riskLevel] ?? '⚪';
  console.log(`${emoji} 지정학적 리스크 레벨: ${riskLevel}`);

  return parsed;
}

// ── Private: 에이전트 실행 ───────────────────────────────────

/**
 * 단일 에이전트 Gemini 호출
 * @param {Object} model           - Gemini 모델 인스턴스
 * @param {string} agentPrompt     - 에이전트 페르소나 프롬프트
 * @param {string} newsHeadlines   - 분석할 뉴스 헤드라인
 * @returns {Promise<string>}      - 에이전트 분석 텍스트
 */
async function callAgent(model, agentPrompt, newsHeadlines) {
  const fullPrompt = `${agentPrompt}\n\n[분석 대상 뉴스]\n${newsHeadlines}`;
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
}

/**
 * 4인 에이전트 병렬 실행 → agentDebate 객체 반환
 * Why: Promise.all로 병렬 처리하여 순차 호출 대비 응답 시간을 ~3배 단축
 */
async function runMultiAgentDebate(model, newsHeadlines) {
  const [macroAnalysis, technicalAnalysis, fundamentalAnalysis, riskAnalysis] =
    await Promise.all([
      callAgent(model, AGENT_PROMPTS.agentA_macro, newsHeadlines),
      callAgent(model, AGENT_PROMPTS.agentB_technical, newsHeadlines),
      callAgent(model, AGENT_PROMPTS.agentC_fundamental, newsHeadlines),
      callAgent(model, AGENT_PROMPTS.agentD_risk, newsHeadlines),
    ]);

  return {
    agentA_macro: macroAnalysis,
    agentB_technical: technicalAnalysis,
    agentC_fundamental: fundamentalAnalysis,
    agentD_risk: riskAnalysis,
  };
}

/**
 * 4인 토론 결과를 종합하여 최종 블로그 포스팅 생성 (HTML 형식)
 * @returns {Promise<{title, summary, htmlContent}>}
 */
async function generateFinalPost(model, agentDebate) {
  const debateSummary = Object.entries(agentDebate)
    .map(([agentName, analysis]) => `[${agentName}]\n${analysis}`)
    .join('\n\n');

  const fullPrompt = `${COORDINATOR_PROMPT}\n\n${debateSummary}`;
  const result = await model.generateContent(fullPrompt);
  const rawText = result.response.text();
  return parseFinalPostResponse(rawText);
}

// ── Public API ────────────────────────────────────────────────

/**
 * 뉴스 분석 전체 파이프라인 실행
 *
 * Step 1) 4인 에이전트 Gemini 병렬 분석 → agentDebate JSON 생성
 * Step 2) Coordinator가 토론 종합 → HTML 블로그 본문 + 자동 선정 제목 생성
 * Step 3) Google Sheets(Apps Script Proxy)에 결과 저장
 *
 * @param {Object} input
 * @param {string} input.newsHeadlines - 분석할 뉴스 헤드라인 (여러 줄 가능)
 * @param {string} input.category      - 섹터 (AI, 반도체, 전기차, 매크로 등)
 * @param {string} input.keywords      - 주요 종목/키워드 (예: NVDA, CPI)
 * @returns {Promise<Object>}          - { agentDebate, finalPost, title, summary, savedAt }
 */
async function analyzeAndSave({ newsHeadlines, category, keywords }) {
  if (!newsHeadlines || !category || !keywords) {
    throw new Error('newsHeadlines, category, keywords는 필수 입력값입니다.');
  }

  const model = getGeminiModel();

  console.log('🤖 [1/3] 4인 에이전트 병렬 분석 시작...');
  const agentDebate = await runMultiAgentDebate(model, newsHeadlines);
  console.log('✅ 에이전트 토론 완료');

  console.log('✍️  [2/3] 최종 블로그 포스팅 생성 중...');
  const { title, summary, htmlContent } = await generateFinalPost(model, agentDebate);
  console.log(`✅ 포스팅 생성 완료 — 제목: ${title}`);

  console.log('💾 [3/3] Google Sheets 저장 중...');
  const today = new Date().toISOString().split('T')[0];
  await appendResearchRow({
    date: today,
    title,
    category,
    keywords,
    agentDebate,
    finalPost: htmlContent,
    status: false,
  });
  console.log('✅ 시트 저장 완료');

  return { agentDebate, finalPost: htmlContent, title, summary, savedAt: today };
}

/**
 * 완전 자동화 워크플로우 — 뉴스 수집부터 텔레그램 알림까지 원클릭 실행
 *
 * Step 1) RSS 수집      → 최신 금융 뉴스 헤드라인 취득
 * Step 2) 키워드 추출   → Gemini가 오늘의 카테고리·키워드·대표 뉴스 자동 선별
 * Step 3) 에이전트 분석 → 4인 병렬 토론
 * Step 4) HTML 포스팅   → 제목 자동 선정 + 티스토리용 HTML 본문 생성
 * Step 5) 시트 저장     → Google Sheets(Apps Script Proxy) 영구 저장
 * Step 6) 텔레그램 알림 → 제목·요약·시트 링크 발송
 *
 * @returns {Promise<Object>} { geopoliticalRiskLevel, category, keywords, title, summary, agentDebate, finalPost, savedAt }
 */
async function runAutoWorkflow() {
  const model = getGeminiModel();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 VibeCoding-IR 자동 분석 워크플로우 시작');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: 뉴스 수집
  console.log('📡 [1/5] RSS 뉴스 수집 중...');
  const headlines = await fetchLatestHeadlines();

  // Step 2: 키워드 자동 추출 (지정학 가중치 필터링 포함)
  console.log('🔍 [2/5] 오늘의 카테고리·키워드 추출 중...');
  const { geopoliticalRiskLevel, category, keywords, selectedHeadlines, reason } =
    await extractTodayKeywords(model, headlines);
  console.log(`✅ 카테고리: ${category} | 키워드: ${keywords}`);
  console.log(`   선택 근거: ${reason}`);

  // Step 3~5: 에이전트 분석 + 포스팅 생성 + 시트 저장
  const result = await analyzeAndSave({
    newsHeadlines: selectedHeadlines,
    category,
    keywords,
  });

  // Step 6: 텔레그램 알림 발송
  console.log('📱 [5/5] 텔레그램 알림 발송 중...');
  await sendTelegramNotification({
    title: result.title,
    summary: result.summary,
    sheetUrl: process.env.GOOGLE_SHEETS_URL ?? '',
  });

  return { geopoliticalRiskLevel, category, keywords, ...result };
}

module.exports = { analyzeAndSave, runAutoWorkflow, extractTodayKeywords };
