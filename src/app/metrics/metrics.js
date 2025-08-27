import createError from 'http-errors';
import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';
import { METRICS_ERROR } from '../../config/error.js';
import redisConnection from '../util/redisConnection.js'; 

const metrics = async function serviceMetrics(req, res, next) {
  
  const cacheKey = 'metrics_data';

  try {
    const startTime = req.query.startTime ? new Date(req.query.startTime) : new Date(0);
    const endTime = req.query.endTime ? new Date(req.query.endTime) : new Date(8640000000000000);

    
    const redisClient = await redisConnection();

    //buscar dados do cache Redis
    const fetchFromCache = async () => {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);  //retorna os dados armazenados no cache
      }
      return null; 
    };

    const cacheTimeout = process.env.CACHE_TIMEOUT
    let cacheData;
    
    try {
      cacheData = await Promise.race([
        fetchFromCache(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis timeout')), cacheTimeout) 
        ),
      ]);
    } catch (err) { 
      cacheData = null; //se o Redis não responder em tempo, ignora o cache
    }

    //se os dados estiverem no cache, retorna imediatamente
    if (cacheData) {
      return res.status(200).json(cacheData);  
    }

    //se não estiver no cache, executa as consultas ao banco
    const result = await db.sequelize.transaction(async (t) => {
        
      const translations = await db.Translation.count({
        where: {
          translation: { [db.Sequelize.Op.not]: null },
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        transaction: t,
      });

      const reviews = await db.Review.count({
        where: {
          review: { [db.Sequelize.Op.not]: null },
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        transaction: t,
      });

      const ratings = await db.Review.findAll({
        attributes: ['rating', [db.Sequelize.fn('COUNT', db.sequelize.col('rating')), 'count']],
        where: {
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        group: ['rating'],
        transaction: t,
      });

      for (const rating of ratings) {
        rating.rating = rating.rating ? "good" : "bad";
      }

      const hits = await db.Hit.findAll({
        attributes: [
          [db.sequelize.col('text'), '_id'],
          [db.sequelize.fn('SUM', db.sequelize.col('hits')), 'hits']
        ],
        group: ['text'],
        order: [[db.sequelize.fn('SUM', db.sequelize.col('hits')), 'DESC']],
        limit: 10,
        transaction: t,
      });

      return {
        translations,
        reviews,
        ratings,
        hits,
      };
    });

    //tenta armazenar os dados no Redis com um tempo de expiração
    try {
      await redisClient.setex(cacheKey, 3600, JSON.stringify(result));  //cache com expiração de 1 hora
      //console.log('Data saved to Redis cache');
    } catch (err) {
      //console.log('Failed to save to Redis:', err.message);
    }

    return res.status(200).json({
      translationsCount: result.translations,
      reviewsCount: result.reviews,
      ratingsCounters: result.ratings,
      translationsHits: result.hits,
    });
  } catch (error) {
    serverError(error.message);
    return next(createError(500, METRICS_ERROR.metricsError));
  }
};

export default metrics;