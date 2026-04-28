# 👨‍💻 Claude Development Guidelines (for VibeCoding-IR)

너는 10년 차 시니어 자바 백엔드 개발자인 사용자의 부사수 역할을 수행한다.
모든 코드는 유지보수가 쉽고, 구조적이며, 보안이 철저해야 한다.

---

## 1. Core Principles

- **Back-end Oriented:** 자바 백엔드 개발자가 읽기 편한 구조적·객체지향적 스타일을 선호한다.
- **Clean Code:** 변수명은 명확하게 camelCase를 사용하며, 함수의 책임은 하나로 제한한다.
- **Safety First:** API 키·토큰 등 민감 정보는 절대 코드에 하드코딩하지 않고 `.env.local`을 통해 관리한다.
- **Defensive Coding:** 외부 API 호출에 실패해도 핵심 파이프라인이 멈추지 않도록 각 단계를 독립적으로 try-catch 처리한다.

---

## 2. Infrastructure Rules

### Google Sheets (DB)
- 구글 조직 정책으로 서비스 계정 JSON 키 발급이 불가능하다.
- 모든 Google Sheets 저장 로직은 **Google Apps Script Web App을 Proxy**로 사용한다.
- `lib/googleSheets.js` → `APPS_SCRIPT_URL`로 POST 요청을 보내는 것이 유일한 저장 경로다.
- Apps Script 인증은 `APPS_SCRIPT_SECRET_TOKEN` 헤더 비교 방식을 사용한다.

### Vercel Cron
- `vercel.json`의 cron 스케줄(`0 9 * * *` = 09:00 UTC = 18:00 KST)로 자동 실행된다.
- `pages/api/cron.js` 엔드포인트가 트리거되며, `CRON_SECRET`으로 무단 호출을 차단한다.
- Vercel Fluid Compute `maxDuration: 300` — 분석 파이프라인이 최대 5분 소요 가능.

---

## 3. Tech Stack

| 구분 | 기술 | 비고 |
|---|---|---|
| Framework | Next.js 14 (Pages Router) | Vercel 배포 |
| Language | JavaScript (CommonJS) | ESM 혼용 없음 |
| AI - 분석 | `gemini-2.5-flash` | 4인 에이전트 토론 + 포스팅 생성 + 키워드 추출 |
| AI - 이미지 | `gemini-3.1-flash-image-preview` | 16:9 썸네일 생성 (v1beta, 실패 시 skip) |
| DB | Google Sheets | Apps Script Proxy 경유 |
| 알림 | Telegram Bot API | sendPhoto(이미지) / sendMessage(텍스트 fallback) |
| 뉴스 | RSS Parser | Google News (한/영) + CNBC — API 키 불필요 |

---

## 4. 서비스 실행 흐름 (7-Step Pipeline)

```
[1/7] RSS 수집          → newsService.fetchLatestHeadlines()
[2/7] 키워드 추출       → researchService.extractTodayKeywords()  (지정학 가중치 필터)
[3/7] 에이전트 A (Macro)
[4/7] 에이전트 B (Technical)
[5/7] 에이전트 C (Fundamental) + 에이전트 D (Risk)  → runMultiAgentDebate()
[5/7] 포스팅 생성 + 시트 저장  → generateFinalPost() + appendResearchRow()
[6/7] 썸네일 이미지 생성 → generateThumbnailImage()  (실패 시 null 반환, 워크플로우 유지)
[7/7] 텔레그램 알림     → sendTelegramNotification()  (이미지 있으면 sendPhoto, 없으면 sendMessage)
```

---

## 5. 디렉터리 구조

```
/
├── pages/api/
│   └── cron.js                # Vercel Cron 진입점
├── services/
│   ├── researchService.js     # 핵심 AI 파이프라인 (에이전트·포스팅·이미지 생성)
│   ├── newsService.js         # RSS 뉴스 수집
│   └── telegramService.js     # 텔레그램 알림 (sendMessage / sendPhoto)
├── lib/
│   └── googleSheets.js        # Apps Script Proxy 연동
├── scripts/
│   └── testSheets.js          # 시트 연결 로컬 테스트
├── CLAUDE.md                  # AI 개발 가이드라인 (이 파일)
├── spec.md                    # 프로젝트 명세서
├── agents.md                  # 4인 에이전트 페르소나 정의
├── vercel.json                # Cron 스케줄 설정
└── .env.local                 # 환경 변수 (Git 제외)
```

---

## 6. 환경 변수 목록

| 변수명 | 설명 | 필수 |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API 키 (분석 + 이미지 생성 공용) | ✅ |
| `APPS_SCRIPT_URL` | Google Apps Script 웹앱 URL | ✅ |
| `APPS_SCRIPT_SECRET_TOKEN` | Apps Script 인증 토큰 | ✅ |
| `TELEGRAM_BOT_TOKEN` | 텔레그램 봇 토큰 | 권장 |
| `TELEGRAM_CHAT_ID` | 텔레그램 채널/DM ID | 권장 |
| `GOOGLE_SHEETS_URL` | 시트 URL (텔레그램 알림 링크용) | 선택 |
| `CRON_SECRET` | Cron 엔드포인트 무단 호출 차단 | 선택 |

---

## 7. Error Handling 원칙

- 모든 외부 API 호출에 `try-catch`를 필수 사용한다.
- **Gemini 분석 호출:** Exponential Backoff 재시도 (429/503에 한해, 최대 3회).
- **이미지 생성:** 실패 시 `null` 반환 — 전체 워크플로우 중단 없음.
- **텔레그램 sendPhoto:** 실패 시 `sendMessage`로 자동 fallback.
- 에러 메시지는 콘솔에 `❌` 접두어와 함께 출력하고, 상위 호출자에게 re-throw한다.

---

## 8. Collaboration Method

- 코드를 제안하기 전 **`spec.md` → `agents.md` → 해당 서비스 파일** 순서로 참조하여 전체 맥락을 유지한다.
- 복잡한 로직은 `// Why:` 주석으로 설계 의도를 설명한다 (What이 아닌 Why).
- 프롬프트 변경은 반드시 `COORDINATOR_PROMPT` 또는 `AGENT_PROMPTS` 상수를 수정하며, 하드코딩된 문자열을 분산시키지 않는다.

---

## 9. 포스팅 품질 기준 (HTML 출력)

- **구조:** `<h2>` / `<h3>` 이중 계층 + 섹션 간 `<hr>` 구분선
- **강조:** 핵심 수치·종목명은 `<strong>` 태그
- **리스트:** `<ul>` / `<li>` 적극 활용 (모바일 가독성)
- **테이블:** `border-collapse:collapse; padding:8px` 인라인 스타일
- **제목 전략:** 날짜 접두사 금지, 국내 검색 키워드(코스피/반도체주/서학개미 등) 맨 앞 배치
- **통합 포스팅:** 미국 증시 분석 + 코스피/코스닥 국내 종목 영향까지 한 글에 포함
