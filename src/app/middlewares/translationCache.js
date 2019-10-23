import crypto from 'crypto';
import redisConnection from '../util/redisConnection';

const translationCache = async function getTranslationCache(req, res, next) {
  try {
    const redisClient = await redisConnection();
    const buffer = Buffer.from(req.body.text.replace(/[^A-Z0-9]/ig, '').toLowerCase());

    req.body.textHash = crypto.createHash('md5').update(buffer).digest('hex');
    const cachedTranslation = await redisClient.get(req.body.textHash);

    if (cachedTranslation === null) {
      return next();
    }

    return res.status(200).send(cachedTranslation);
  } catch (error) {
    return next();
  }
};

export default translationCache;
