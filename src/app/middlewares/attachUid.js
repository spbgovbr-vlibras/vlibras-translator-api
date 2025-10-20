import { v4 as uuid } from 'uuid';

export function attachUid(req, res, next) {
  req.uid = uuid();
  next();
}