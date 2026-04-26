require('dotenv').config();

const { initSheetHeaders, appendResearchRow } = require('../lib/googleSheets');

async function main() {
  console.log('🔌 Google Sheets 연결 테스트 시작...');

  await initSheetHeaders();

  const testData = {
    date: new Date().toISOString().split('T')[0],
    category: '테스트',
    keywords: 'NVDA, AAPL, CPI',
    agentDebate: JSON.stringify({
      macro: '연준 금리 동결 전망으로 성장주 반등 기대',
      technical: 'NVDA 지지선 $900 확인, 이동평균선 골든크로스 임박',
      fundamental: 'NVDA PER 35배, 실적 서프라이즈 지속 가능성 높음',
      risk: '중국 수출 규제 재강화 시 단기 조정 가능성',
    }),
    finalPost: '[테스트] 이 행은 연동 확인용 샘플 데이터입니다.',
    status: false,
  };

  const result = await appendResearchRow(testData);
  console.log('✅ 데이터 입력 성공!');
  console.log('   업데이트된 셀 범위:', result.updatedRange);
  console.log('   추가된 행 수:', result.updatedRows);
}

main().catch((err) => {
  console.error('❌ 오류 발생:', err.message);
  process.exit(1);
});
