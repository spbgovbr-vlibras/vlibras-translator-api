import createError from 'http-errors';
import { serverError, serverInfo } from '../util/debugger.js';
import { REVIEW_ERROR } from '../../config/error.js';


function isAllUpper(str) {
  return typeof str === 'string'
    && str.trim().length > 0
    && /[\p{Lu}]/u.test(str)
    && !/[\p{Ll}]/u.test(str);
}

function normalizeForCompare(str) {
  return String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = (a[i - 1] === b[j - 1]) ? prev : Math.min(dp[j] + 1, dp[j - 1] + 1, prev + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (levenshtein(a, b) / maxLen);
}


export function validateTranslationReviewSecure(opts = {}) {
  const {
    minSimilarity = 0.5,
    maxSimilarity = 0.95,
    maxLength = 5000
  } = opts;

  return function (req, res, next) {
    try {
      const { translation: tRaw, review: rRaw, rating } = req.body;
      const problems = [];

      if (typeof tRaw !== 'string' || !tRaw.trim()) {
        problems.push('translation-missing');
      }

      if (rating === 'bad') {
        if (typeof rRaw !== 'string' || !rRaw.trim()) {
          problems.push('review-required-for-bad-rating');
          serverInfo(
            `[validateTranslationReview] Review required when rating is 'bad' - ` +
            `IP=${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`
          );
          return next(createError(400, 'Review is required when rating is bad.'));
        }
      } else {
        return next();
      }

      if (problems.length === 0) {
        if (!isAllUpper(tRaw) || !isAllUpper(rRaw)) {
          problems.push('not-uppercase');
        }

        if (tRaw.length > maxLength || rRaw.length > maxLength) {
          problems.push('too-long');
        }

        if (problems.length === 0) {
          const t = normalizeForCompare(tRaw);
          const r = normalizeForCompare(rRaw);
          const sim = similarity(t, r);

          if (sim < minSimilarity) {
            problems.push('suggestion-too-different');
            serverInfo(
              `[validateTranslationReview] Suggestion too different - ` +
              `similarity=${sim.toFixed(2)}, min=${minSimilarity}`
            );
          }
          else if (sim > maxSimilarity) {
            problems.push('suggestion-too-similar');
            serverInfo(
              `[validateTranslationReview] Suggestion too similar - ` +
              `similarity=${sim.toFixed(2)}, max=${maxSimilarity}`
            );
          }
        }
      }

      if (problems.length > 0) {
        serverInfo(
          `[validateTranslationReview] validation failed - ` +
          `IP=${req.ip || req.headers['x-forwarded-for'] || 'unknown'}, ` +
          `reasons=${problems.join(',')}`
        );

        const publicMsg = REVIEW_ERROR?.reviewError || 'Invalid suggestion.';
        return next(createError(400, publicMsg));
      }

      next();
    } catch (e) {
      serverError(`[validateTranslationReview] exception: ${e.message}`);
      const publicMsg = REVIEW_ERROR?.reviewError || 'Invalid suggestion.';
      next(createError(400, publicMsg));
    }
  };
}