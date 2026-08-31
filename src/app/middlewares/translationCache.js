import crypto from 'crypto';
import db from '../db/models/index.js';
import { cacheError } from '../util/debugger.js';
import redisConnection from '../util/redisConnection.js';

/**
 * Cache namespaces. Each route stores a different payload shape for the same
 * input text, so the namespace must be part of the key to avoid one route
 * serving the other route's cached value.
 */
const CACHE_NAMESPACES = {
  translation: 'translate',
  sentiment: 'sentiment',
};

const normalizeTextForCache = (text) => Buffer.from(
  text.replace(/[^A-Za-z0-9\s?!.,;:()]/g, '').toLowerCase(),
);

const buildTextHash = (text, namespace = CACHE_NAMESPACES.translation) => {
  const digest = crypto.createHash('md5').update(normalizeTextForCache(text)).digest('hex');

  return `${namespace}:${digest}`;
};

const getCachedTranslation = async (text, namespace = CACHE_NAMESPACES.translation) => {
  const redisClient = await redisConnection();
  const textHash = buildTextHash(text, namespace);
  const cachedTranslation = await redisClient.get(textHash);

  return { cachedTranslation, textHash };
};

/**
 * Turns a raw cached value into the payload each route answers with, plus the
 * gloss that gets counted at the DB. Returns null when the cached value does
 * not match the namespace shape, so the request falls through as a cache miss.
 */
const parseCachedValue = function parseCachedValueByNamespace(namespace, cachedValue) {
  if (namespace !== CACHE_NAMESPACES.sentiment) {
    return { payload: cachedValue, translation: cachedValue, isJson: false };
  }

  try {
    const payload = JSON.parse(cachedValue);

    if (payload === null || typeof payload !== 'object' || payload.traducao === undefined) {
      return null;
    }

    return { payload, translation: payload.traducao, isJson: true };
  } catch (error) {
    return null;
  }
};

const createTranslationCache = function createTranslationCacheMiddleware(
  namespace = CACHE_NAMESPACES.translation,
) {
  return async function getTranslationCache(req, res, next) {
    const uid = req.uid;
    try {
      console.log(`[Cache][${uid}] - Conexão com Redis estabelecida`);
      const { cachedTranslation, textHash } = await getCachedTranslation(req.body.text, namespace);

      req.body.textHash = textHash;

      if (cachedTranslation === null) {
        console.log(`[Cache][${uid}] - Tradução não está no cache`);
        return next();
      }

      const cacheEntry = parseCachedValue(namespace, cachedTranslation);

      if (cacheEntry === null) {
        console.warn(`[Cache][${uid}] - Valor em cache inválido para "${namespace}", ignorando`);
        return next();
      }

      console.log(`[Cache][${uid}] - Tradução está no cache`);
      const text = req.body.text;
      const requester =
        req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      try {
        await countCachedTranslation(text, cacheEntry.translation, requester);
      } catch (error) {
        cacheError(`COUNT ${error.message}`);
      }

      return cacheEntry.isJson
        ? res.status(200).json(cacheEntry.payload)
        : res.status(200).send(cacheEntry.payload);
    } catch (error) {
      console.log(`[Cache][${uid}] - Error no cache`);
      cacheError(`GET ${error.message}`);
      return next();
    }
  };
};

const countCachedTranslation = async function countCachedTranslationController(text, translation, requester) {
  const translationRequest = db.Translation.build({
    text,
    translation,
    requester,
  });

  await translationRequest.save();
};

const translationCache = createTranslationCache(CACHE_NAMESPACES.translation);

export default translationCache;
export {
  CACHE_NAMESPACES,
  buildTextHash,
  createTranslationCache,
  getCachedTranslation,
};
