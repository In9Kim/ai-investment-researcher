// services/telegramService.js
// 배치 완료 후 텔레그램으로 [제목 · 요약 · 시트 링크] 알림 발송
// 필요 환경 변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_SHEETS_URL

/**
 * HTML parse_mode에서 &, <, > 를 이스케이프
 * Why: 제목·요약에 HTML 특수문자가 섞이면 텔레그램 파싱 오류 발생
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 텔레그램 채널/DM으로 데일리 리포트 완성 알림 발송
 *
 * @param {Object} params
 * @param {string} params.title    - Gemini가 자동 선정한 포스팅 제목
 * @param {string} params.summary  - 🔴🟡🟢 3줄 요약 (plain text)
 * @param {string} params.sheetUrl - Google Sheets URL (HTML 복사용)
 */
async function sendTelegramNotification({ title, summary, sheetUrl }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정 — 텔레그램 알림 건너뜀');
    return;
  }

  const today = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const linkLine = sheetUrl
    ? `🔗 <a href="${sheetUrl}">시트에서 HTML 복사하기</a>`
    : '🔗 시트 링크 미설정 (GOOGLE_SHEETS_URL 환경 변수 확인)';

  const message = [
    `📊 <b>VibeCoding-IR 데일리 리포트 완성!</b>`,
    `📅 ${today}`,
    ``,
    `📌 <b>오늘의 제목</b>`,
    escapeHtml(title),
    ``,
    `💡 <b>핵심 요약</b>`,
    escapeHtml(summary),
    ``,
    linkLine,
    ``,
    `<i>집에서 시트 열고 HTML 복사 → 티스토리 붙여넣기 끝!</i>`,
  ].join('\n');

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`텔레그램 알림 발송 실패: HTTP ${response.status} — ${errorText}`);
  }

  console.log('✅ 텔레그램 알림 발송 완료');
}

module.exports = { sendTelegramNotification };
