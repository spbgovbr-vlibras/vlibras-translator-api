import { Router } from 'express';
import { videoValidationRules, idValidationRules, checkValidation } from '../middlewares/validator.js';
import { videoMaker, videoStatus, videoDownload } from './videoMaker.js';

const videoMakerRouter = Router();

videoMakerRouter
  .post('/video', videoValidationRules, checkValidation, videoMaker)
  .get('/video/status/:requestUID', idValidationRules, checkValidation, videoStatus)
  .get('/video/download/:requestUID', idValidationRules, checkValidation, videoDownload);

export default videoMakerRouter;
