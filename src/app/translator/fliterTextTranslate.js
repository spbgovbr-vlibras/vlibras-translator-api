import DailyAccess from './DailyAccess';


const fliterTextTranslate = async function fliterTextTranslateController(req, res, next) {
  const xDaysBack = new Date(new Date() - 1000 * 60 * 60 * 24 * req.query.days);
  try {
    const translates = await DailyAccess.find({
      site: req.query.domain, createdAt: { $gte: xDaysBack },
    });
    res.status(200).send(translates);
    return translates;
  } catch (error) {
    return next(error);
  }
};

export default fliterTextTranslate;
