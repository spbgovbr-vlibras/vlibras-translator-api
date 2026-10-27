import crypto from 'crypto';
import db from '../db/models/index.js';
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
  const log = req.log.child({ component: 'cache' });
  try {
    const { cachedTranslation, textHash } = await getCachedTranslation(req.body.text);

    req.body.textHash = textHash;

    if (cachedTranslation === null) {
      log.debug('Tradução não está no cache');
      return next();
    } else {
      log.debug('Tradução está no cache');
      const text = req.body.text;
      const translation = cachedTranslation;
      const requester =
        req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      try {
        await countCachedTranslation(text, translation, requester);
      } catch (error) {
        log.error({ err: error }, 'Falha ao registrar tradução vinda do cache');
      }
    }

    return res.status(200).send(cachedTranslation);
  } catch (error) {
    log.error({ err: error }, 'Falha ao consultar o cache');
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
  getCachedTranslation,
};
