const axios = require('axios');
const logger = require('~/config/winston');

const {
  FAQ_API_URL = 'http://localhost:3002/faqs',
  FAQ_API_TIMEOUT_MS,
  FAQ_CACHE_TTL_MS,
  FAQ_MAX_RESULTS,
  FAQ_CONTEXT_CHAR_LIMIT,
} = process.env ?? {};

const DEFAULT_TIMEOUT = Number(FAQ_API_TIMEOUT_MS) || 4000;
const DEFAULT_CACHE_TTL = Number(FAQ_CACHE_TTL_MS) || 60_000;
const DEFAULT_LIMIT = Number(FAQ_MAX_RESULTS) || 5;
const CONTEXT_CHAR_LIMIT = Number(FAQ_CONTEXT_CHAR_LIMIT) || 2000;

let cache = {
  value: null,
  expiresAt: 0,
};

/**
 * Fetches FAQs from the configured API with simple in-memory caching.
 * @returns {Promise<Array<{question?: string, answer?: string}>>}
 */
async function fetchFaqs() {
  if (!FAQ_API_URL) {
    logger.warn('[FAQ] FAQ_API_URL is not configured. Skipping FAQ fetch.');
    return [];
  }

  const now = Date.now();
  if (cache.value && cache.expiresAt > now) {
    return cache.value;
  }

  try {
    const { data } = await axios.get(FAQ_API_URL, {
      timeout: DEFAULT_TIMEOUT,
    });
    const faqs = Array.isArray(data) ? data : [];
    cache = {
      value: faqs,
      expiresAt: now + DEFAULT_CACHE_TTL,
    };
    return faqs;
  } catch (error) {
    logger.warn(`[FAQ] Failed to fetch FAQs from ${FAQ_API_URL}: ${error.message}`);
    return cache.value ?? [];
  }
}

/**
 * Scores FAQs based on token overlap with the user query.
 * @param {Array<{question?: string, answer?: string}>} faqs
 * @param {string} query
 * @returns {Array<{question?: string, answer?: string}>}
 */
function selectRelevantFaqs(faqs, query) {
  if (!faqs.length) {
    return [];
  }

  if (!query || typeof query !== 'string') {
    return faqs.slice(0, DEFAULT_LIMIT);
  }

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return faqs.slice(0, DEFAULT_LIMIT);
  }

  const scored = faqs
    .map((faq, index) => {
      // Support multiple field name variations including bilingual fields
      const question = String(faq.question ?? faq.questionEnglish ?? faq.title ?? '').toLowerCase();
      const answer = String(faq.answer ?? faq.answerEnglish ?? faq.response ?? '').toLowerCase();
      // Also include Hindi fields for better matching
      const questionHindi = String(faq.questionHindi ?? '').toLowerCase();
      const answerHindi = String(faq.answerHindi ?? '').toLowerCase();
      const combined = `${question} ${answer} ${questionHindi} ${answerHindi}`;
      const score = tokens.reduce((acc, token) => acc + (combined.includes(token) ? 1 : 0), 0);

      return { score, faq, index };
    })
    .filter(({ score }) => score > 0);

  if (!scored.length) {
    return faqs.slice(0, DEFAULT_LIMIT);
  }

  scored.sort((a, b) => {
    if (b.score === a.score) {
      return a.index - b.index;
    }
    return b.score - a.score;
  });

  return scored.slice(0, DEFAULT_LIMIT).map(({ faq }) => faq);
}

/**
 * Formats FAQs into a compact context string.
 * @param {Array<{question?: string, answer?: string}>} faqs
 * @returns {string}
 */
function formatFaqContext(faqs) {
  if (!faqs.length) {
    return '';
  }

  const formatted = faqs
    .map((faq, idx) => {
      // Support multiple field name variations including bilingual fields
      const question = faq.question ?? faq.questionEnglish ?? faq.title ?? 'Question unavailable';
      const answer = faq.answer ?? faq.answerEnglish ?? faq.response ?? 'Answer unavailable';
      return `FAQ ${idx + 1}:\nQuestion: ${question}\nAnswer: ${answer}`;
    })
    .join('\n\n');

  return formatted.slice(0, CONTEXT_CHAR_LIMIT);
}

/**
 * Retrieves formatted FAQ context for a given query.
 * @param {string} query
 * @returns {Promise<string|null>}
 */
async function getFaqContext(query) {
  const faqs = await fetchFaqs();
  if (!faqs.length) {
    return null;
  }

  const relevant = selectRelevantFaqs(faqs, query);
  if (!relevant.length) {
    return null;
  }

  return formatFaqContext(relevant);
}

module.exports = {
  getFaqContext,
};
