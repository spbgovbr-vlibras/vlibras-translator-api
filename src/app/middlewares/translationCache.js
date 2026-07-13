import crypto from 'crypto';
import db from '../db/models/index.js';
import { cacheError } from '../util/debugger.js';
import redisConnection from '../util/redisConnection.js';

const normalizeTextForCache = (text) => Buffer.from(
  text.replace(/[^A-Za-z0-9\s?!.,;:()]/g, '').toLowerCase(),
);

const buildTextHash = (text) => crypto.createHash('md5').update(normalizeTextForCache(text)).digest('hex');

const getCachedTranslation = async (text) => {
  const redisClient = await redisConnection();
  const textHash = buildTextHash(text);
  const cachedTranslation = await redisClient.get(textHash);

  return { cachedTranslation, textHash };
};

const translationCache = async function getTranslationCache(req, res, next) {
  const uid = req.uid;
  try {
    console.log(`[Cache][${uid}] - Conexão com Redis estabelecida`);
    const { cachedTranslation, textHash } = await getCachedTranslation(req.body.text);

    req.body.textHash = textHash;

    if (cachedTranslation === null) {
      console.log(`[Cache][${uid}] - Tradução não está no cache`);
      return next();
    } else {
      console.log(`[Cache][${uid}] - Tradução está no cache`);
      const text = req.body.text;
      const translation = cachedTranslation;
      const requester =
        req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      try {
        await countCachedTranslation(text, translation, requester);
      } catch (error) {
        cacheError(`COUNT ${error.message}`);
      }
    }

    return res.status(200).send(cachedTranslation);
  } catch (error) {
    console.log(`[Cache][${uid}] - Error no cache`);
    cacheError(`GET ${error.message}`);
    return next();
  }
};

const countCachedTranslation = async function countCachedTranslationController(text, translation, requester) {
  const translationRequest = db.Translation.build({
    text,
    translation,
    requester,
  });

  await translationRequest.save();
};

export default translationCache;
export {
  buildTextHash,
  getCachedTranslation,
};
