import express from 'express';
import { check } from 'express-validator/check';
import { videoMaker, videoStatus, videoDownload } from '../controllers/videoMaker';

const videoMakerRouter = express.Router();

videoMakerRouter
	.post('/video', [
		check('gloss').isLength({ min: 1, max: 5000 }), 
		check('avatar').matches(/^icaro$|^hozana$/),
		check('caption').matches(/^enable$|^disable$/)], videoMaker)
	.get('/video/status/:requestUID', check('requestUID').isUUID(4), videoStatus)
	.get('/video/download/:requestUID', check('requestUID').isUUID(4), videoDownload);

export default videoMakerRouter;
