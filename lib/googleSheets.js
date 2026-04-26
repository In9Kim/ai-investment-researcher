// lib/googleSheets.js
// Google Apps Script 웹앱을 Proxy로 사용하여 Google Sheets에 데이터 저장
// Why: 구글 조직 정책으로 서비스 계정 JSON 키 발급 불가 → Apps Script 방식으로 우회

/**
 * Google Sheets에 투자 리서치 데이터 한 행 추가
 * @param {Object}        data
 * @param {string}        data.date        - 분석 날짜 (YYYY-MM-DD)
 * @param {string}        data.title       - Gemini 자동 선정 포스팅 제목 (※ Apps Script에 Title 컬럼 추가 필요)
 * @param {string}        data.category    - 섹터 (AI, 반도체, 전기차, 매크로 등)
 * @param {string}        data.keywords    - 주요 종목/키워드 (예: NVDA, Apple, CPI)
 * @param {Object|string} data.agentDebate - 4인 에이전트 토론 결과 (객체 또는 JSON 문자열)
 * @param {string}        data.finalPost   - 최종 블로그 포스팅 전문 (HTML 형식)
 * @param {boolean}       data.status      - 블로그 발행 여부
 */
async function appendResearchRow(data) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const secretToken = process.env.APPS_SCRIPT_SECRET_TOKEN;

  if (!appsScriptUrl) {
    throw new Error('APPS_SCRIPT_URL 환경 변수가 설정되지 않았습니다.');
  }

  // agentDebate는 객체·문자열 양쪽으로 받을 수 있으므로 객체로 통일하여 전송
  const agentDebateObject =
    typeof data.agentDebate === 'string'
      ? JSON.parse(data.agentDebate)
      : data.agentDebate;

  const payload = {
    secretToken,
    date: data.date,
    title: data.title ?? '',
    category: data.category,
    keywords: data.keywords,
    agentDebate: agentDebateObject,
    finalPost: data.finalPost,
    status: data.status ?? false,
  };

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Apps Script 요청 실패: HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Apps Script 오류: ${result.error}`);
  }

  return result.data;
}

module.exports = { appendResearchRow };
