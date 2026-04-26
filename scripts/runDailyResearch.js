// scripts/runDailyResearch.js
// GitHub Actions 크론에서 직접 실행하는 엔트리포인트
// 실행: node scripts/runDailyResearch.js

require('dotenv').config();

const { runAutoWorkflow } = require('../services/researchService');

(async () => {
  try {
    const result = await runAutoWorkflow();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 워크플로우 완료 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📌 제목    : ${result.title}`);
    console.log(`🗂️  카테고리: ${result.category}`);
    console.log(`🔑 키워드  : ${result.keywords}`);
    console.log(`📅 저장일  : ${result.savedAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 워크플로우 실패:', error.message);
    process.exit(1);
  }
})();
