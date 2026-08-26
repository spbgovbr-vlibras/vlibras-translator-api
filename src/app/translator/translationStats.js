import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';
import phraseBreaker from '../util/phraseBreaker.js';

const createStatsRecorder = ({
  database = db,
  logger = serverError,
  splitPhrases = phraseBreaker,
  schedule = setTimeout,
} = {}) => {
  const storeStats = async function storeStatsController(req) {
    try {
      const phrases = await splitPhrases(req.body.text);
      await database.sequelize.transaction(async (t) => {
        for (let i = 0; i < phrases.length; i += 1) {
          const phrase = phrases[i].trim();
          const translationAlreadyExists = await database.Hit.findOne({
            where: {
              text: phrase,
            },
            transaction: t,
          });

          if (translationAlreadyExists) {
            translationAlreadyExists.set({ hits: translationAlreadyExists.hits + 1 });
            await translationAlreadyExists.save({ transaction: t });
          } else {
            const translationHit = database.Hit.build({
              text: phrase,
              hits: 1,
            });
            await translationHit.save({ transaction: t });
          }
        }
      });
    } catch (error) {
      logger('Text translator failed storing stats');
    }
  };

  const scheduleStoreStats = (req) => schedule(storeStats, 10, req);

  return {
    scheduleStoreStats,
    storeStats,
  };
};

const { scheduleStoreStats, storeStats } = createStatsRecorder();

export { createStatsRecorder, scheduleStoreStats, storeStats };
