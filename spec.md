# 📑 Project Specification: AI 투자 리서치 자동화 시스템 (VibeCoding-IR)

## 1. 프로젝트 개요
* **명칭:** AI Multi-Agent Investment Researcher (VibeCoding-IR)
* **목적:** Gemini 및 Claude API를 활용해 미국 증시 주요 이슈를 4가지 관점에서 심층 분석하고, 티스토리/네이버 블로그용 고퀄리티 콘텐츠를 자동 생성 및 DB화함.
* **핵심 타겟:** 미국 주식 투자자(서학개미), 기술주 중심 투자자, 경제 공부를 시작하는 직장인.

## 2. 기술 스택 (Tech Stack)
* **Frontend/Backend:** Vercel (Next.js 또는 정적 HTML/JS)
* **AI Engine:** Gemini 1.5 Pro (데이터 분석), Claude 3.5 Sonnet (포스팅 작성)
* **Database:** **Google Sheets API** (초기 단계 관리 및 데이터 축적)
* **Infrastructure:** GitHub Actions (주기적 자동 분석 예약 - 선택 사항)

## 3. 시스템 아키텍처 (Workflow)
1. **Data Ingestion:** 뉴스 API 또는 RSS를 통해 당일 나스닥/S&P 500 주요 헤드라인 수집.
2. **Multi-Agent Analysis (Gemini):**
    * **Agent A (Macro):** 거시 경제 지표 및 연준 금리 영향 분석.
    * **Agent B (Technical):** 차트 지지선 및 이동평균선 기반 분석.
    * **Agent C (Fundamental):** 기업 실적 및 밸류에이션 분석.
    * **Agent D (Risk Manager):** 잠재적 위기 요소 및 반대 의견 제시.
3. **Consolidation (Claude):** 4인 토론 내용을 바탕으로 티스토리용 SEO 최적화 포스팅 생성.
4. **Data Persistence:** 분석 결과와 포스팅 텍스트를 **Google Sheets**에 기록.
5. **Output:** 생성된 텍스트를 사용자가 복사하여 티스토리/네이버 블로그에 발행.

## 4. 데이터베이스 설계 (Google Sheets Schema)
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| **Date** | Date | 분석 날짜 (YYYY-MM-DD) |
| **Category** | String | 섹터 (AI, 반도체, 전기차, 매크로 등) |
| **Keywords** | String | 주요 종목 및 키워드 (예: NVDA, Apple, CPI) |
| **Agent_Debate** | Text | 4인 에이전트의 토론 원문 (JSON 형식) |
| **Final_Post** | Text | 클로드가 최종 작성한 블로그 포스팅 전문 |
| **Status** | Boolean | 블로그 발행 여부 (T/F) |

## 5. 단계별 개발 계획 (Roadmap)
### **Phase 1: 인프라 연결 (핵심 목표)**
* [ ] Google Cloud Console에서 Sheets API 활성화 및 서비스 계정 키 발급.
* [ ] Vercel 환경 변수에 Google 인증 정보 추가.

### **Phase 2: 멀티 에이전트 로직 고도화**
* [ ] 4인 에이전트별 페르소나 프롬프트 정교화.
* [ ] 금융 전문 용어 및 고단가 키워드 사전 구축.

### **Phase 3: DB 연동 및 UI 구현**
* [ ] 버튼 클릭 시 [분석 -> 시트 저장 -> 결과 출력] 파이프라인 완성.
* [ ] 티스토리용 '복사하기' 버튼 및 미리보기 화면 구현.

## 6. 기대 효과
* **수익화:** 애드센스 고단가 키워드 공략 및 쿠팡 파트너스(서적 등) 간접 노출.
* **자산화:** 매일 쌓이는 구글 시트 데이터는 추후 나만의 투자 인사이트 DB가 됨.
* **브랜딩:** "AI를 다루는 개발자의 전문적인 투자 일지"라는 독보적 블로그 정체성 확립.

---
**개발자 메모:** "구글 시트를 DB로 사용하므로 서버 유지보수 비용이 0원이며, 추후 데이터 확장 시 Supabase 등으로 마이그레이션이 용이한 구조임."
