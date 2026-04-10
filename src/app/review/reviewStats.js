import createError from 'http-errors';
import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';

const reviewStats = async function reviewStatsController(req, res, next) {
  try {
    const { rating } = req.query;

    const whereClause = {
      review: { [db.Sequelize.Op.not]: null },
    };

    if (rating === 'bad') {
      whereClause.rating = false;
    } else if (rating === 'good') {
      whereClause.rating = true;
    }

    const reviews = await db.Review.findAll({
      attributes: ['translationId', 'review', 'rating', 'createdAt'],
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });

    const translationIds = [
      ...new Set(
        reviews
          .map((item) => item.translationId)
          .filter(Boolean)
      ),
    ];

    if (translationIds.length === 0) {
      return res.status(200).json({ reviewRanking: [] });
    }

    const translations = await db.Translation.findAll({
      attributes: ['id', 'text', 'translation'],
      where: {
        id: {
          [db.Sequelize.Op.in]: translationIds,
        },
      },
    });

    const translationsMap = new Map();
    translations.forEach((item) => {
      translationsMap.set(item.id, item);
    });

    const reviewRanking = [];

reviews.forEach((reviewItem) => {
  const translationItem = translationsMap.get(reviewItem.translationId);

  if (!translationItem) return;
  if (!translationItem.translation) return;

  reviewRanking.push({
    text: translationItem.text,
    translation: translationItem.translation,
    review: reviewItem.review || '',
  });
});

return res.status(200).json({ reviewRanking 
    });
  } catch (error) {
    serverError(error.message);
    return next(createError(500, 'Failed to fetch review stats'));
  }
};

export default reviewStats;