// services/telegramService.js
// 배치 완료 후 텔레그램으로 [썸네일 이미지 + 제목 · 요약 · 시트 링크] 알림 발송
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
 * 텔레그램 sendMessage API — 텍스트 전용 알림
 */
async function sendTelegramMessage({ botToken, chatId, text }) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`텔레그램 메시지 발송 실패: HTTP ${response.status} — ${errorText}`);
  }
}

/**
 * 텔레그램 sendPhoto API — 이미지 + 캡션 알림
 * Why: FormData multipart 방식 — 텔레그램 Bot API는 이미지를 Base64 인라인으로 받지 않음
 */
async function sendTelegramPhoto({ botToken, chatId, photoBuffer, photoMimeType, caption }) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(
    'photo',
    new Blob([photoBuffer], { type: photoMimeType }),
    'thumbnail.png'
  );
  // 캡션은 1024자 제한 — 초과 시 자동 자름
  formData.append('caption', caption.slice(0, 1024));
  formData.append('parse_mode', 'HTML');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`텔레그램 사진 발송 실패: HTTP ${response.status} — ${errorText}`);
  }
}

/**
 * 텔레그램 채널/DM으로 데일리 리포트 완성 알림 발송 (텍스트 전용)
 *
 * @param {Object} params
 * @param {string} params.title         - Gemini가 자동 선정한 포스팅 제목
 * @param {string} params.summary       - 🔴🟡🟢 3줄 요약 (plain text)
 * @param {string} params.koreanStocks  - 핵심 국내 종목 3개 요약 (plain text, 줄바꿈 구분)
 * @param {string} params.sheetUrl      - Google Sheets URL
 */
async function sendTelegramNotification({
  title,
  summary,
  koreanStocks = '',
  sheetUrl,
}) {
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

  const koreanStocksSection = koreanStocks
    ? [``, `🇰🇷 <b>오늘 주목할 국내 종목 TOP 3</b>`, escapeHtml(koreanStocks)]
    : [];

  const messageText = [
    `📊 <b>VibeCoding-IR 데일리 리포트 완성!</b>`,
    `📅 ${today}`,
    ``,
    `📌 <b>오늘의 제목</b>`,
    escapeHtml(title),
    ``,
    `💡 <b>핵심 요약</b>`,
    escapeHtml(summary),
    ...koreanStocksSection,
    ``,
    linkLine,
    ``,
    `<i>시트 열고 HTML 복사 → 티스토리 붙여넣기 끝!</i>`,
  ].join('\n');

  try {
    await sendTelegramMessage({ botToken, chatId, text: messageText });
    console.log('✅ 텔레그램 알림 발송 완료');
  } catch (error) {
    throw new Error(`텔레그램 알림 최종 실패: ${error.message}`);
  }
}

module.exports = { sendTelegramNotification };
