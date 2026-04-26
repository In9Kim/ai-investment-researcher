// scripts/testResearch.js
// 실행 방법:
//   자동 모드 (RSS 수집 → 키워드 추출 → 분석 → 저장): node scripts/testResearch.js
//   수동 모드 (하드코딩 입력):                          node scripts/testResearch.js --manual

require('dotenv').config({ path: '.env.local' });

const { runAutoWorkflow, analyzeAndSave } = require('../services/researchService');

// ── 수동 모드 테스트 입력값 ──────────────────────────────────
const MANUAL_INPUT = {
  newsHeadlines: `
- Fed Powell: "인플레이션이 목표치 2%를 향해 진전 중이나 추가 데이터 필요"
- NVIDIA Q1 실적 발표: EPS $6.12 (예상 $5.65) 대폭 어닝 서프라이즈
- 중국, 미국산 반도체 장비 추가 규제 검토 중 — 공급망 우려 재부상
  `.trim(),
  category: '반도체/AI',
  keywords: 'NVDA, Fed, 금리, 반도체 규제',
};

// ── 결과 출력 헬퍼 ───────────────────────────────────────────

function printResult(result) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 에이전트 토론 결과 미리보기');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Object.entries(result.agentDebate).forEach(([agent, analysis]) => {
    console.log(`\n[${agent}]`);
    console.log(analysis.slice(0, 180) + '...');
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 최종 블로그 포스팅 (첫 300자 미리보기)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(result.finalPost.slice(0, 300) + '\n...');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 완료! 저장 날짜: ${result.savedAt}`);
  console.log('   → 구글 시트에서 최신 행을 확인하세요.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ── 실행 ─────────────────────────────────────────────────────

async function main() {
  const isManual = process.argv.includes('--manual');

  try {
    let result;

    if (isManual) {
      console.log('🛠️  수동 모드로 실행합니다 (하드코딩 입력값 사용)');
      result = await analyzeAndSave(MANUAL_INPUT);
    } else {
      console.log('🤖 자동 모드로 실행합니다 (RSS 수집 → 키워드 자동 추출)');
      result = await runAutoWorkflow();
    }

    printResult(result);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
