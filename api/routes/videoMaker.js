import express from 'express';
import { check } from 'express-validator/check';
import { videoMaker, videoStatus, videoDownload } from '../controllers/videoMaker';

const videoMakerRouter = express.Router();

videoMakerRouter
	.post('/video', check('gloss').not().isEmpty(), videoMaker)
	.get('/video/status/:requestUID', check('requestUID').isUUID(4), videoStatus)
	.get('/video/download/:requestUID', check('requestUID').isUUID(4), videoDownload);

export default videoMakerRouter;
