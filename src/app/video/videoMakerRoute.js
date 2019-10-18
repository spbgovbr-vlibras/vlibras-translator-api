import { Router } from 'express';
import { videoValidationRules, idValidationRules, validate } from '../middlewares/validator';
import { videoMaker, videoStatus, videoDownload } from './videoMaker';

const videoMakerRouter = Router();

videoMakerRouter
  .post('/video', videoValidationRules, validate, videoMaker)
  .get('/video/status/:requestUID', idValidationRules, validate, videoStatus)
  .get('/video/download/:requestUID', idValidationRules, validate, videoDownload);

export default videoMakerRouter;
