# 📑 Project Specification: AI 투자 리서치 자동화 시스템 (VibeCoding-IR)

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| **명칭** | AI Multi-Agent Investment Researcher (VibeCoding-IR) |
| **목적** | Gemini API 기반 멀티에이전트가 미국·한국 증시를 분석하고, 티스토리·네이버 블로그용 SEO 최적화 포스팅을 매일 자동 생성 |
| **핵심 타겟** | 서학개미(미국주식 투자자), 코스피/코스닥 투자자, 경제 공부 초보 직장인 |
| **수익 모델** | 티스토리 애드센스(고단가 금융 키워드), 쿠팡 파트너스(관련 서적) |

---

## 2. 기술 스택

| 구분 | 기술 | 버전 |
|---|---|---|
| Framework | Next.js (Pages Router) | 14.x |
| Runtime | Node.js | 20.x |
| 호스팅 | Vercel (Fluid Compute) | - |
| AI 분석 엔진 | Google Gemini 2.5 Flash | `gemini-2.5-flash` |
| AI 이미지 생성 | Google Gemini 3.1 Flash Image | `gemini-3.1-flash-image-preview` (v1beta) |
| Database | Google Sheets | Apps Script Proxy 경유 |
| 알림 | Telegram Bot API | sendPhoto / sendMessage |
| 뉴스 수집 | RSS Parser | Google News + CNBC |

---

## 3. 시스템 아키텍처 (7-Step Workflow)

```
┌─────────────────────────────────────────────────────────┐
│              Vercel Cron (매일 09:00 UTC = 18:00 KST)   │
│                     ↓ /api/cron                         │
│  [1] RSS 수집 (Google News 한/영 + CNBC, 중복 제거)      │
│                     ↓                                   │
│  [2] 키워드 자동 추출 (지정학 리스크 가중치 필터링)         │
│      → category, keywords, selectedHeadlines 결정       │
│                     ↓                                   │
│  [3~4] 4인 에이전트 순차 토론 (Gemini 2.5 Flash)         │
│      Agent A: 거시경제  /  Agent B: 기술적 분석           │
│      Agent C: 기본적 분석  /  Agent D: 리스크 관리        │
│                     ↓                                   │
│  [5] Coordinator → HTML 통합 포스팅 생성                  │
│      · 미국 증시 + 코스피/코스닥 국내 종목 영향 통합        │
│      · 제목: 날짜 없이 국내 검색 키워드 앞 배치            │
│      → Google Sheets 저장 (Apps Script Proxy)           │
│                     ↓                                   │
│  [6] 썸네일 이미지 생성 (gemini-3.1-flash-image-preview)  │
│      실패 시 null 반환 — 파이프라인 계속 진행              │
│                     ↓                                   │
│  [7] 텔레그램 알림                                        │
│      이미지 있음 → sendPhoto(썸네일 + 캡션)               │
│      이미지 없음 → sendMessage(텍스트 전용)               │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 설계 (Google Sheets Schema)

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| **Date** | Date | 분석 날짜 (YYYY-MM-DD) |
| **Title** | String | Gemini 자동 선정 포스팅 제목 |
| **Category** | String | 섹터 (AI반도체 / 매크로·금리 / 지정학·반도체 / 에너지·매크로 등) |
| **Keywords** | String | 주요 종목·지표 4~6개 (쉼표 구분) |
| **Agent_Debate** | Text | 4인 에이전트 토론 원문 (JSON 객체) |
| **Final_Post** | Text | HTML 형식의 최종 포스팅 전문 |
| **Status** | Boolean | 블로그 발행 여부 (기본: false) |

> **저장 경로:** Node.js → Google Apps Script Web App URL (POST) → Google Sheets  
> **이유:** 구글 조직 정책으로 서비스 계정 JSON 키 발급 불가 → Apps Script Proxy 방식 채택

---

## 5. HTML 포스팅 구조 (티스토리 최적화)

```html
<h2>📰 오늘 시장을 흔든 이슈</h2>
<p>서론</p>
<ul><li><strong>핵심 포인트</strong>: 설명</li></ul>
<hr>

<h2>🗣️ 전문가 4인의 긴급 단톡방</h2>
<blockquote>에이전트 의견 × 4</blockquote>
<hr>

<h2>🇺🇸 미국 증시 핵심 분석</h2>
<h3>거시경제 & 기술적 시그널</h3>
<ul>...</ul>
<hr>

<h2>🇰🇷 코스피/코스닥 오늘의 대응 전략</h2>
<h3>미국 증시 변화 → 국내 주목 종목 연결 분석</h3>
<ul><li><strong>삼성전자·SK하이닉스</strong>: 영향 분석</li></ul>
<hr>

<h2>🎯 종합 투자 인사이트</h2>
<p>미국+한국 통합 결론 (SEO 키워드 포함)</p>
<hr>

<h2>📊 오늘의 투자 매력도 점수</h2>
<table style="border-collapse:collapse; width:100%;">...</table>
<hr>

<h2>⏰ 내일 아침, 딱 하나만 확인하세요</h2>
<blockquote>핵심 지표·이벤트</blockquote>
```

**제목 전략:**
- 날짜 형식(2026.04.28 등) **절대 포함 금지**
- 국내 투자자 검색 키워드(코스피 대응 전략 / 반도체주 전망 / 서학개미 필독 등) **맨 앞 배치**

---

## 6. 지정학적 리스크 분류 체계

| 레벨 | 트리거 | Category 매핑 |
|---|---|---|
| 🔴 HIGH | 전쟁·제재·수출 규제·유가 급변 | 지정학/반도체 · 에너지/매크로 |
| 🟠 MEDIUM | Fed 결정·CPI·고용지표 충격·국채 급등 | 매크로/금리 |
| 🟡 LOW | 빅테크 실적·AI 투자·반도체 공급망 | AI반도체 · 빅테크 · 전기차 |
| ⚪ NONE | 개별 종목 이슈 | 뉴스 내 최다 언급 섹터 |

---

## 7. 환경 변수 목록

| 변수명 | 필수 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini API 키 (분석 + 이미지 공용) |
| `APPS_SCRIPT_URL` | ✅ | Google Apps Script 웹앱 배포 URL |
| `APPS_SCRIPT_SECRET_TOKEN` | ✅ | Apps Script 요청 인증 토큰 |
| `TELEGRAM_BOT_TOKEN` | 권장 | @BotFather 발급 봇 토큰 |
| `TELEGRAM_CHAT_ID` | 권장 | 알림 수신 채널/DM ID |
| `GOOGLE_SHEETS_URL` | 선택 | 텔레그램 알림의 시트 링크 |
| `CRON_SECRET` | 선택 | `/api/cron` 무단 호출 방지 |

---

## 8. 개발 로드맵

### Phase 1: 인프라 연결 ✅ 완료
- [x] Google Apps Script Web App Proxy 구축
- [x] Vercel 환경 변수 등록 및 Cron 스케줄 설정
- [x] RSS 뉴스 수집 (Google News 한/영 + CNBC 3소스 이중화)

### Phase 2: 멀티 에이전트 로직 ✅ 완료
- [x] 4인 에이전트 페르소나 프롬프트 정교화 (`agents.md`)
- [x] 지정학적 리스크 가중치 기반 키워드 자동 추출
- [x] Exponential Backoff 재시도 로직 (429/503 에러 복원)
- [x] HTML 통합 포스팅 생성 (미국 + 코스피/코스닥)

### Phase 3: 알림·이미지 ✅ 완료
- [x] 텔레그램 알림 연동 (sendMessage)
- [x] 썸네일 이미지 자동 생성 (gemini-3.1-flash-image-preview)
- [x] 텔레그램 sendPhoto + 실패 시 텍스트 fallback

### Phase 4: SEO 고도화 ✅ 완료
- [x] HTML 구조 개편 (`<h2>/<h3>/<hr>/<ul>/<li>`)
- [x] Table 인라인 스타일 (border-collapse, padding)
- [x] 제목 전략 변경 (날짜 제거, 국내 키워드 앞배치)
- [x] 코스피/코스닥 국내 종목 연결 분석 섹션 신설

### Phase 5: 차기 고도화 (예정)
- [ ] 블로그 UI — 결과 미리보기 + 1-Click 복사 버튼
- [ ] 티스토리 Open API 자동 발행 연동
- [ ] 분석 데이터 시각화 대시보드 (Charts.js)
- [ ] 구글 시트 → Supabase 마이그레이션 (데이터 확장 시)
- [ ] 네이버 블로그 자동 발행 연동

---

## 9. 기대 효과

| 목표 | 내용 |
|---|---|
| **수익화** | 애드센스 고단가 금융 키워드 + 쿠팡 파트너스 |
| **자산화** | Google Sheets 누적 데이터 → 개인 투자 인사이트 DB |
| **브랜딩** | "AI를 다루는 개발자의 전문 투자 일지" 블로그 정체성 확립 |

> **비용 구조:** Google Sheets DB = 서버 유지 비용 0원. 추후 Supabase 마이그레이션으로 확장 용이.
