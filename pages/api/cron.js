// pages/api/cron.js
// Vercel Cron Job 엔드포인트 — vercel.json의 schedule에 따라 자동 호출됨
// 스케줄: 매일 09:00 UTC (= 18:00 KST)
// 보안: CRON_SECRET 환경 변수로 무단 호출 차단

const { runAutoWorkflow } = require('../../services/researchService');

// Vercel Fluid Compute — 분석 파이프라인이 최대 5분 소요될 수 있으므로 타임아웃 연장
export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  // POST 또는 GET만 허용 (Vercel Cron은 GET으로 호출)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // CRON_SECRET이 설정된 경우 Authorization 헤더 검증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('⏰ Vercel Cron 트리거 — 데일리 리서치 워크플로우 시작');
    const result = await runAutoWorkflow();

    return res.status(200).json({
      success: true,
      title: result.title,
      category: result.category,
      keywords: result.keywords,
      savedAt: result.savedAt,
    });
  } catch (error) {
    console.error('❌ 크론 워크플로우 실패:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
