// scripts/runDailyResearch.js
// GitHub Actions 크론에서 직접 실행하는 엔트리포인트
// 실행: node scripts/runDailyResearch.js
// 예상 소요 시간: 에이전트 4회 + 코디네이터 1회 × (API 응답 + 3s 지연) ≈ 1~2분 (유료 티어)

require('dotenv').config();

const { runAutoWorkflow } = require('../services/researchService');

(async () => {
  const startedAt = Date.now();

  try {
    const result = await runAutoWorkflow();

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 워크플로우 완료 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📌 제목    : ${result.title}`);
    console.log(`🗂️  카테고리: ${result.category}`);
    console.log(`🔑 키워드  : ${result.keywords}`);
    console.log(`📅 저장일  : ${result.savedAt}`);
    console.log(`⏱️  소요 시간: ${elapsedSec}초`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 워크플로우 실패:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();
