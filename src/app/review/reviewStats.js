import createError from "http-errors";
import db from "../db/models/index.js";
import { serverError } from "../util/debugger.js";

const reviewStats = async function reviewStatsController(req, res, next) {
  try {
    const { rating } = req.query;
    const replacements = {};
    let ratingFilter = "";
    if (rating === "bad") {
      replacements.rating = false;
      ratingFilter = 'AND reviews."rating" = :rating';
    } else if (rating === "good") {
      replacements.rating = true;
      ratingFilter = 'AND reviews."rating" = :rating';
    }

    const reviewRanking = await db.sequelize.query(
      `
        SELECT
          translations."text" AS "text",
          translations."translation" AS "translation",
          reviews."review" AS "review"
        FROM "Reviews" AS reviews
        INNER JOIN "Translations" AS translations
          ON translations."id" = reviews."translationId"
        WHERE reviews."review" IS NOT NULL
          AND translations."translation" IS NOT NULL
          AND translations."translation" <> ''
          ${ratingFilter}
        ORDER BY reviews."createdAt" DESC
      `,
      {
        replacements,
        type: db.Sequelize.QueryTypes.SELECT,
      },
    );

    return res.status(200).json({
      reviewRanking,
    });
  } catch (error) {
    serverError(error.message);
    return next(createError(500, "Failed to fetch review stats"));
  }
};

export default reviewStats;
