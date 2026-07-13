import { Router } from 'express';
import env from '../../config/environments/environment.js';
import createApiKeyAuthMiddleware from '../middlewares/apiKeyAuth.js';
import { textValidationRules, refineValidationRules, checkValidation } from '../middlewares/validator.js';
import translationCache from '../middlewares/translationCache.js';
import { createGlossRefinementEnabledMiddleware } from './glossRefinement.js';
import { textTranslator, sentimentTranslator, refinedTextTranslator } from './textTranslator.js';

const textTranslatorRoute = Router();
const glossRefinementApiKeyAuth = createApiKeyAuthMiddleware(env, {
  apiKeysKey: 'GLOSS_REFINEMENT_API_KEYS',
  enabled: true,
  fallbackApiKeysKey: 'API_KEYS',
  fallbackHeaderNameKey: 'API_KEY_HEADER',
  headerNameKey: 'GLOSS_REFINEMENT_API_KEY_HEADER',
});
const glossRefinementEnabled = createGlossRefinementEnabledMiddleware(env);

textTranslatorRoute.post(
  '/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator,
);

textTranslatorRoute.post(
  '/translatesentiment',
  textValidationRules,
  checkValidation,
  translationCache,
  sentimentTranslator,
);

textTranslatorRoute.post(
  '/refine',
  glossRefinementEnabled,
  glossRefinementApiKeyAuth,
  refineValidationRules,
  checkValidation,
  refinedTextTranslator,
);

export default textTranslatorRoute;
