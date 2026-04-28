# 🤖 AI Multi-Agent Investment Researcher (VibeCoding-IR)

> Gemini 멀티에이전트가 미국·한국 증시를 매일 자동 분석하고, 티스토리용 SEO 최적화 포스팅과 텔레그램 알림을 자동 생성하는 시스템

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| **뉴스 자동 수집** | Google News(한/영) + CNBC RSS — API 키 없이 무료 |
| **지정학 리스크 필터링** | 전쟁·제재·CPI·Fed 발언 등 우선순위 자동 분류 |
| **4인 AI 에이전트 토론** | 거시경제·기술적·기본적 분석·리스크 관리 4인이 각자 분석 |
| **통합 HTML 포스팅** | 미국 증시 + 코스피/코스닥 국내 종목 연결 분석을 한 글로 |
| **썸네일 자동 생성** | Gemini 3.1 Flash Image로 16:9 블로그 썸네일 생성 |
| **텔레그램 알림** | 썸네일 이미지 + 제목·요약·시트 링크 자동 발송 |
| **Google Sheets DB** | 분석 결과 자동 저장 — 서버 유지비용 0원 |
| **Vercel Cron 자동화** | 매일 18:00 KST(09:00 UTC) 자동 실행 |

---

## 🏗️ 시스템 흐름

```
Vercel Cron (18:00 KST)
    │
    ▼
[1] RSS 뉴스 수집 (3소스 병렬 → 중복 제거)
    │
    ▼
[2] 키워드 추출 (Gemini — 지정학 가중치 필터링)
    │  → category / keywords / 핵심 헤드라인 5개 선별
    ▼
[3~5] 4인 에이전트 순차 분석 (Gemini 2.5 Flash)
    │  Agent A: 거시경제  B: 기술적  C: 기본적  D: 리스크
    │  → HTML 통합 포스팅 생성 (미국 + 코스피 연결)
    │  → Google Sheets 저장
    ▼
[6] 썸네일 이미지 생성 (gemini-3.1-flash-image-preview)
    │  실패 시 skip — 파이프라인 중단 없음
    ▼
[7] 텔레그램 알림 (이미지 + 제목 + 요약 + 시트 링크)
```

---

## 🛠️ 기술 스택

- **Framework:** Next.js 14 (Pages Router) + Vercel
- **AI 분석:** Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **AI 이미지:** Google Gemini 3.1 Flash Image (`gemini-3.1-flash-image-preview`)
- **Database:** Google Sheets (Apps Script Proxy)
- **알림:** Telegram Bot API
- **뉴스:** RSS Parser (Google News + CNBC)

---

## 🚀 시작하기

### 1. 저장소 클론 및 의존성 설치

```bash
git clone <repo-url>
cd AI-Multi-Agent-Investment-Researcher
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 아래 값을 채워넣으세요.

```env
# Gemini API (분석 + 이미지 생성 공용)
GEMINI_API_KEY=your_gemini_api_key

# Google Apps Script Proxy (Google Sheets DB)
APPS_SCRIPT_URL=your_apps_script_web_app_url
APPS_SCRIPT_SECRET_TOKEN=your_secret_token

# 텔레그램 알림 (선택 — 없으면 알림 건너뜀)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 텔레그램 알림 내 시트 링크 (선택)
GOOGLE_SHEETS_URL=your_google_sheets_url

# Cron 엔드포인트 보안 (선택)
CRON_SECRET=your_cron_secret
```

### 3. Google Apps Script 설정

서비스 계정 방식이 불가한 경우, Apps Script Web App을 Proxy로 사용합니다.

1. Google Sheets에서 **확장 프로그램 → Apps Script** 열기
2. 아래 코드를 붙여넣고 웹앱으로 배포 (액세스: 모든 사용자)

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  // 보안 토큰 검증
  if (data.secretToken !== 'your_secret_token') {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Unauthorized' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 헤더가 없으면 첫 행에 추가
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Title', 'Category', 'Keywords', 'Agent_Debate', 'Final_Post', 'Status']);
  }

  sheet.appendRow([
    data.date,
    data.title,
    data.category,
    data.keywords,
    JSON.stringify(data.agentDebate),
    data.finalPost,
    data.status,
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, data: { updatedRange: 'A:G', updatedRows: 1 } })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

3. 배포 후 생성된 URL을 `APPS_SCRIPT_URL`에 설정

### 4. 로컬 개발 실행

```bash
# Next.js 개발 서버
npm run dev

# Google Sheets 연결 테스트
npm run test:sheets
```

### 5. 수동 분석 실행 (API 호출)

```bash
# CRON_SECRET 없이 테스트
curl http://localhost:3000/api/cron

# CRON_SECRET 설정된 경우
curl -H "Authorization: Bearer your_cron_secret" http://localhost:3000/api/cron
```

---

## 📁 디렉터리 구조

```
/
├── pages/
│   └── api/
│       └── cron.js              # Vercel Cron 진입점
├── services/
│   ├── researchService.js       # 핵심 AI 파이프라인
│   ├── newsService.js           # RSS 뉴스 수집
│   └── telegramService.js       # 텔레그램 알림
├── lib/
│   └── googleSheets.js          # Google Sheets 저장
├── scripts/
│   └── testSheets.js            # 시트 연결 테스트
├── CLAUDE.md                    # AI 개발 가이드라인
├── spec.md                      # 프로젝트 명세서
├── agents.md                    # 4인 에이전트 페르소나 정의
├── vercel.json                  # Cron 스케줄 (09:00 UTC)
└── .env.local                   # 환경 변수 (Git 미포함)
```

---

## 🤖 4인 에이전트 소개

| 에이전트 | 페르소나 | 분석 관점 |
|---|---|---|
| **Agent A** | 연준 출신 거시경제 분석가 | 금리·CPI·고용·달러지수 → 유동성 영향 |
| **Agent B** | 퀀트 트레이더 | RSI·MACD·이동평균선 → 지지선/저항선 레벨 |
| **Agent C** | 가치투자 펀드매니저 | EPS·PER·해자(Moat) → 장기 투자 판단 |
| **Agent D** | 리스크 매니저 | 블랙스완·규제·지정학 → 하방 시나리오 경고 |

---

## 📊 Google Sheets DB 스키마

| 컬럼 | 설명 |
|---|---|
| Date | 분석 날짜 (YYYY-MM-DD) |
| Title | 자동 생성 포스팅 제목 |
| Category | 섹터 (AI반도체 / 매크로·금리 / 지정학 등) |
| Keywords | 핵심 종목·지표 (쉼표 구분) |
| Agent_Debate | 4인 토론 원문 (JSON) |
| Final_Post | HTML 포스팅 전문 |
| Status | 발행 여부 (false/true) |

---

## ⚠️ 주의사항

- `.env.local`은 절대 Git에 커밋하지 마세요. (`.gitignore`에 포함 필수)
- `gemini-3.1-flash-image-preview`는 Preview 모델로 할당량이 제한적입니다. 이미지 생성 실패 시 텍스트 알림만 발송됩니다.
- Google Apps Script Web App은 배포할 때마다 URL이 변경될 수 있으니 주의하세요.
- Vercel 무료 플랜에서는 Cron 실행 횟수 제한이 있습니다. 유료 플랜(Pro) 권장.

---

## 📈 개발 로드맵

- [x] RSS 뉴스 수집 + 중복 제거
- [x] 4인 AI 에이전트 토론 파이프라인
- [x] HTML 포스팅 자동 생성 (미국 + 코스피 통합)
- [x] Google Sheets 자동 저장
- [x] 텔레그램 알림 (이미지 + 텍스트 fallback)
- [x] 썸네일 이미지 자동 생성
- [x] Vercel Cron 자동화 (18:00 KST)
- [ ] 블로그 UI (결과 미리보기 + 1-Click 복사)
- [ ] 티스토리 Open API 자동 발행
- [ ] 분석 데이터 시각화 대시보드
