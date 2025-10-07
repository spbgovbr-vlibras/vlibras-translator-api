import createError from 'http-errors';
import { serverError } from '../util/debugger.js';
import { REVIEW_ERROR } from '../../config/error.js';
import db from '../db/models/index.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('vlibras-translator-api');

const getRequesterIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x_forwarded_for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  let remote = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  if (remote.startsWith('::ffff:')) remote = remote.substring(7);
  return remote;
};

const translationReview = async function translationReviewController(req, res, next) {
  const handlerSpan = tracer.startSpan('translationReview', {
    attributes: {
      'app.component': 'http',
      'http.route': 'translationReview',
      'http.user_agent': String(req.headers['user-agent'] || ''),
      'net.peer.ip': getRequesterIp(req),
    },
  });

  try {
    const requester = getRequesterIp(req);
    const ratingBool = req.body.rating === 'good';

    await db.sequelize.transaction(async (t) => {
      const txSpan = tracer.startSpan('sequelize.transaction', { attributes: { 'db.system': 'sequelize' } });
      try {
        const findSpan = tracer.startSpan('sequelize.findOne', {
          attributes: { 'db.system': 'sequelize', 'db.entity': 'Translation', 'db.operation': 'findOne' },
        });
        let translation = await db.Translation.findOne({
          where: { translation: req.body.translation, text: req.body.text },
          transaction: t,
        }).finally(() => findSpan.end());

        if (!translation) {
          const buildSpan = tracer.startSpan('sequelize.build', {
            attributes: { 'db.system': 'sequelize', 'db.entity': 'Translation' },
          });
          translation = db.Translation.build({
            text: req.body.text,
            translation: req.body.translation,
            requester,
          });
          buildSpan.end();

          const saveSpan = tracer.startSpan('sequelize.save', {
            attributes: { 'db.system': 'sequelize', 'db.entity': 'Translation' },
          });
          await translation.save({ transaction: t }).finally(() => saveSpan.end());
        }

        const reviewBuildSpan = tracer.startSpan('sequelize.build', {
          attributes: { 'db.system': 'sequelize', 'db.entity': 'Review' },
        });
        const reviewRequest = db.Review.build({
          translationId: translation.id,
          rating: ratingBool,
          review: req.body.review || '',
          requester,
        });
        reviewBuildSpan.end();

        const reviewSaveSpan = tracer.startSpan('sequelize.save', {
          attributes: { 'db.system': 'sequelize', 'db.entity': 'Review' },
        });
        await reviewRequest.save({ transaction: t }).finally(() => reviewSaveSpan.end());
      } catch (err) {
        txSpan.recordException(err);
        txSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        txSpan.end();
      }
    });

    handlerSpan.end();
    return res.sendStatus(200);
  } catch (error) {
    handlerSpan.recordException(error);
    handlerSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    handlerSpan.end();
    serverError(error.message);
    return next(createError(500, REVIEW_ERROR.reviewError));
  }
};

export default translationReview;
