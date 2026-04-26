// services/newsService.js
// 미국 금융 뉴스 RSS 수집 서비스
// 외부 API 키 없이 Google News + CNBC RSS를 무료로 활용

const Parser = require('rss-parser');

// ── RSS 피드 소스 목록 ────────────────────────────────────────

// Why: 단일 소스는 장애 시 전체 파이프라인이 멈춤 → 3개 소스로 이중화
const RSS_FEEDS = [
  {
    name: 'Google News (미국증시 한글)',
    url: 'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD%EC%A3%BC%EC%8B%9D+%EB%82%98%EC%8A%A4%EB%8B%A5+%EC%97%B0%EC%A4%80+%EA%B8%88%EB%A6%AC&hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    name: 'Google News (US Market English)',
    url: 'https://news.google.com/rss/search?q=NASDAQ+S%26P500+Fed+interest+rate+earnings&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'CNBC Finance',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135',
  },
];

const RSS_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ITEMS = 20;

// ── Private Functions ─────────────────────────────────────────

const parser = new Parser({
  timeout: RSS_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; VibeCoding-IR/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

/**
 * 단일 RSS 피드 수집 (실패 시 빈 배열 반환 — 소스 중단이 전체 중단으로 이어지지 않도록)
 */
async function fetchOneFeed(feed, maxItems) {
  try {
    const result = await parser.parseURL(feed.url);
    return result.items.slice(0, maxItems).map((item) => ({
      title: cleanTitle(item.title ?? ''),
      pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
      source: feed.name,
      link: item.link ?? '',
    }));
  } catch (error) {
    console.warn(`⚠️  RSS 수집 실패 (${feed.name}): ${error.message}`);
    return [];
  }
}

/**
 * Google News는 제목 끝에 " - 매체명" 포맷이 붙음 → 제거
 */
function cleanTitle(title) {
  return title.replace(/\s-\s[^-]+$/, '').trim();
}

/**
 * 제목 앞 40자 기준으로 중복 헤드라인 제거
 * Why: 여러 소스에서 동일 뉴스를 다른 표현으로 수집하면 AI 분석이 왜곡됨
 */
function deduplicateHeadlines(headlines) {
  const seen = new Set();
  return headlines.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public API ────────────────────────────────────────────────

/**
 * 전체 RSS 소스에서 최신 금융 뉴스 헤드라인 수집
 * @param {number} maxItems - 소스별 최대 수집 개수 (기본 20)
 * @returns {Promise<Array<{title, pubDate, source, link}>>} 최신순 정렬된 헤드라인 목록
 */
async function fetchLatestHeadlines(maxItems = DEFAULT_MAX_ITEMS) {
  console.log(`📡 뉴스 수집 중... (소스 ${RSS_FEEDS.length}개, 소스당 최대 ${maxItems}건)`);

  const results = await Promise.all(RSS_FEEDS.map((feed) => fetchOneFeed(feed, maxItems)));

  const allHeadlines = results.flat();

  if (allHeadlines.length === 0) {
    throw new Error('모든 RSS 소스에서 뉴스 수집에 실패했습니다. 네트워크 상태를 확인하세요.');
  }

  const deduplicated = deduplicateHeadlines(allHeadlines);
  const sorted = deduplicated.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  console.log(`✅ 총 ${sorted.length}건 수집 완료 (중복 제거 후)`);
  return sorted;
}

/**
 * 헤드라인 배열을 AI 프롬프트용 문자열로 변환
 * @param {Array} headlines - fetchLatestHeadlines 반환값
 * @returns {string} "- 제목 [출처]" 형식의 멀티라인 문자열
 */
function formatHeadlinesForAI(headlines) {
  return headlines
    .map((h) => `- ${h.title} [${h.source}]`)
    .join('\n');
}

module.exports = { fetchLatestHeadlines, formatHeadlinesForAI };
