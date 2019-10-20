import { Router } from 'express';
import { videoValidationRules, idValidationRules, checkValidation } from '../middlewares/validator';
import { videoMaker, videoStatus, videoDownload } from './videoMaker';

const videoMakerRouter = Router();

videoMakerRouter
  .post('/video', videoValidationRules, checkValidation, videoMaker)
  .get('/video/status/:requestUID', idValidationRules, checkValidation, videoStatus)
  .get('/video/download/:requestUID', idValidationRules, checkValidation, videoDownload);

export default videoMakerRouter;
