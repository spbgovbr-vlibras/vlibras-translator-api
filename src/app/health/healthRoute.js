import createError from 'http-errors';
import { Router } from 'express';
import { getDetailedHealthResponse, getPublicHealthResponse } from './health.js';
import { textTranslatorHealth } from '../translator/textTranslator.js';

const healthRouter = Router();
const parseAllowedIps = (rawValue = '') => rawValue
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);
const getDetailedHealthAllowedIps = () => {
  const configuredIps = parseAllowedIps(process.env.INTERNAL_STATUS_ALLOWED_IPS);

  if (configuredIps.length > 0) {
    return configuredIps;
  }

  return null;
};
const isDetailedHealthAllowed = (ip) => {
  const allowedIps = getDetailedHealthAllowedIps();

  if (allowedIps === null) {
    return true;
  }

  return allowedIps.includes(ip);
};

healthRouter.get('/health', (_req, res) => {
  res.status(200).json(getPublicHealthResponse());
});

healthRouter.get('/status', async (req, res, next) => {
  try {
    if (!isDetailedHealthAllowed(req.ip)) {
      return next(createError(404));
    }

    req.body = { text: 'Ola mundo da vida' };
    let content;

    try {
      content = await textTranslatorHealth(req, res, () => undefined);
    } catch (error) {
      content = undefined;
    }

    const response = await getDetailedHealthResponse(content);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
});

export default healthRouter;
export { parseAllowedIps, getDetailedHealthAllowedIps, isDetailedHealthAllowed };
