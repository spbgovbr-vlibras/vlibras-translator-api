import db from "../db/models/index.js";
import { cacheError } from "../util/debugger.js";
import crypto from "crypto";
import redisConnection from "../util/redisConnection.js";

const translationCache = async function getTranslationCache(req, res, next) {
  const uid = req.uid;
  try {
    const redisClient = await redisConnection();
    const buffer = Buffer.from(
      req.body.text.replace(/[^A-Z0-9]/gi, "").toLowerCase()
    );

    console.log(`[Cache][${uid}] - Conexão com Redis estabelecida`);

    req.body.textHash = crypto.createHash("md5").update(buffer).digest("hex");
    const cachedTranslation = await redisClient.get(req.body.textHash);

    if (cachedTranslation === null) {
      console.log(`[Cache][${uid}] - Tradução não está no cache`);
      return next();
    } else {
      console.log(`[Cache][${uid}] - Tradução está no cache`);
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
    console.log(`[Cache][${uid}] - Error no cache`);
    cacheError(`GET ${error.message}`);
    return next();
  }
};

const countCachedTranslation = async function (text, translation, requester) {
  const translationRequest = db.Translation.build({
    text,
    translation,
    requester,
  });

  await translationRequest.save();
};

export default translationCache;
