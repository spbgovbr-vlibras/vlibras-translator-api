import db from "../db/models/index.js";
import { cacheError } from "../util/debugger.js";
import crypto from "crypto";
import redisConnection from "../util/redisConnection.js";

import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("vlibras-translator-api");

const translationCache = async function getTranslationCache(req, res, next) {
  const handlerSpan = tracer.startSpan("translationCache", {
    attributes: { "app.component": "cache" },
  });
  const uid = req.uid;
  try {
    const connectSpan = tracer.startSpan("redis.connect", {
      attributes: { "db.system": "redis" },
    });
    const redisClient = await redisConnection().finally(() => connectSpan.end());

    const hashSpan = tracer.startSpan("hash.md5");
    const buffer = Buffer.from(
      req.body.text.replace(/[^A-Z0-9]/gi, "").toLowerCase()
    );
    req.body.textHash = crypto.createHash("md5").update(buffer).digest("hex");
    hashSpan.end();

    console.log(`[Cache][${uid}] - Conexão com Redis estabelecida`);

    const getSpan = tracer.startSpan("redis.get", {
      attributes: { "db.system": "redis", "db.operation": "GET" },
    });
    const cachedTranslation = await redisClient.get(req.body.textHash).finally(() => getSpan.end());

    if (cachedTranslation === null) {
      console.log(`[Cache][${uid}] - Tradução não está no cache`);
      handlerSpan.end();
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

    handlerSpan.end();
    return res.status(200).send(cachedTranslation);
  } catch (error) {
    console.log(`[Cache][${uid}] - Error no cache`);
    cacheError(`GET ${error.message}`);
    handlerSpan.recordException(error);
    handlerSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    handlerSpan.end();
    return next();
  }
};

const countCachedTranslation = async function (text, translation, requester) {
  const span = tracer.startSpan("countCachedTranslation", {
    attributes: { "db.system": "sequelize", "db.entity": "Translation" },
  });
  try {
    const translationRequest = db.Translation.build({
      text,
      translation,
      requester,
    });

    const saveSpan = tracer.startSpan("sequelize.save", {
      attributes: { "db.system": "sequelize", "db.entity": "Translation" },
    });
    await translationRequest.save().finally(() => saveSpan.end());
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
};

export default translationCache;
