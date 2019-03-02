import createError from 'http-errors';
import { validationResult } from 'express-validator/check';

const translator = async function textTranslator(req, res, next) {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(createError(422, errors.array()));
  }

  try {
    res.status(200).json(req.body.text);
  }
  catch (err) {
    next(err);
  }
  
}

export default translator;