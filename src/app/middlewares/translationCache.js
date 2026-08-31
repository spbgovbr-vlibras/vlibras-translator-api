import crypto from 'crypto';
import env from '../../config/environments/environment.js';
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

const digestText = (text) => crypto.createHash('md5').update(normalizeTextForCache(text)).digest('hex');

const buildTextHash = (text, namespace = CACHE_NAMESPACES.translation) => `${namespace}:${digestText(text)}`;

/**
 * Key format used before the namespaces existed: the bare digest, shared by
 * both routes. Kept only to warm the namespaced keys from entries already in
 * Redis; nothing writes to it anymore.
 */
const buildLegacyTextHash = (text) => digestText(text);

const parseSentimentPayload = function parseSentimentCachePayload(cachedValue) {
  try {
    const payload = JSON.parse(cachedValue);

    if (payload === null || typeof payload !== 'object' || payload.traducao === undefined) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
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

  const payload = parseSentimentPayload(cachedValue);

  return payload === null
    ? null
    : { payload, translation: payload.traducao, isJson: true };
};

/**
 * Legacy keys were written by both routes, so a legacy value may well belong to
 * the other one. Only a value shaped like this namespace's payload is adopted;
 * anything else is left behind to expire.
 */
const belongsToNamespace = function valueBelongsToNamespace(namespace, cachedValue) {
  const isSentimentPayload = parseSentimentPayload(cachedValue) !== null;

  return namespace === CACHE_NAMESPACES.sentiment ? isSentimentPayload : !isSentimentPayload;
};

/**
 * Copies a still-valid legacy entry into its namespaced key, carrying the
 * remaining TTL over so migrated entries keep expiring on the original
 * schedule. The legacy key is left untouched: the copy is additive, so a
 * rollback to the previous release still finds its cache warm.
 */
const adoptLegacyCacheEntry = async function adoptLegacyCacheEntryForNamespace({
  redisClient, text, namespace, textHash,
}) {
  const legacyHash = buildLegacyTextHash(text);
  const legacyValue = await redisClient.get(legacyHash);

  if (legacyValue === null || !belongsToNamespace(namespace, legacyValue)) {
    return null;
  }

  const remainingTtl = await redisClient.pttl(legacyHash);

  if (remainingTtl > 0) {
    await redisClient.set(textHash, legacyValue, 'PX', remainingTtl);
  } else {
    await redisClient.set(textHash, legacyValue, 'EX', env.CACHE_EXP);
  }

  return legacyValue;
};

const getCachedTranslation = async (text, namespace = CACHE_NAMESPACES.translation) => {
  const redisClient = await redisConnection();
  const textHash = buildTextHash(text, namespace);
  const cachedTranslation = await redisClient.get(textHash);

  if (cachedTranslation !== null) {
    return { cachedTranslation, textHash };
  }

  const legacyTranslation = await adoptLegacyCacheEntry({
    redisClient, text, namespace, textHash,
  });

  return { cachedTranslation: legacyTranslation, textHash };
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
  buildLegacyTextHash,
  buildTextHash,
  createTranslationCache,
  getCachedTranslation,
};
