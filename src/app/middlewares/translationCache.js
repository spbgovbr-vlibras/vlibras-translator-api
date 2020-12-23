import Translation from "../translator/Translation";
import { cacheError } from "../util/debugger";
import crypto from "crypto";
import redisConnection from "../util/redisConnection";

const translationCache = async function getTranslationCache(req, res, next) {
  try {
    const redisClient = await redisConnection();
    const buffer = Buffer.from(
      req.body.text.replace(/[^A-Z0-9]/gi, "").toLowerCase()
    );

    req.body.textHash = crypto.createHash("md5").update(buffer).digest("hex");
    const cachedTranslation = await redisClient.get(req.body.textHash);

    if (cachedTranslation === null) {
      return next();
    } else {
      const text = req.body.text;
      const translation = cachedTranslation;
      const requester =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;

      try {
        await countCachedTranslation(text, translation, requester);
      } catch (error) {
        cacheError(`COUNT ${error.message}`);
      }
    }

    return res.status(200).send(cachedTranslation);
  } catch (error) {
    cacheError(`GET ${error.message}`);
    return next();
  }
};

const countCachedTranslation = async function (text, translation, requester) {
  const translationRequest = new Translation({
    text,
    translation,
    requester,
  });

  await translationRequest.save();
};

export default translationCache;
