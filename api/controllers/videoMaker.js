import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';
import setupConnection from '../helpers/queueConnection';
import env from '../config/environments/environment';
import { AVATARS, STATUS } from '../config/video/parameters';
import Video from '../models/video';

const videoMaker = async function librasVideoMaker(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
		const uid = uuid();
		const queueConnection = await setupConnection();
		const connectionChannel = await queueConnection.createChannel();

		const { consumerCount } = await connectionChannel.assertQueue(
			env.VIDEOMAKER_QUEUE, 
			{ durable: false });

		if (consumerCount === 0) {
			return next(createError(500, 'VideoMaker Core Unavailable'));
		}

		const videoGenRequest = new Video({
			gloss: req.body.gloss,
			uid: uid,
			status: STATUS.queued,
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		const videoParams = {
			...(AVATARS.includes(req.query.avatar) && { avatar: req.query.avatar })
		};

		const payload = JSON.stringify({ gloss: req.body.gloss, options: videoParams });

		await connectionChannel.publish(
			'',
			env.VIDEOMAKER_QUEUE,
			Buffer.from(payload),
			{ correlationId: uid }
		);

		await videoGenRequest.save();

		res.status(200).json({ requestUID: uid });

	} catch (error) {
		next(error);
	}

}

const videoStatus = async function librasVideoGenerationStatus(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
			const query = { uid: req.params.requestUID };
			const { status, size } = await Video.findOne(query).exec() || {};

			if (status === undefined) {
				return next(createError(404, 'There is no process with the received UID'));
			} 

			res.status(200).json({ status: status, ...(size && { size: size }) });

	} catch (error) {
		next(error);
	}

}

const videoDownload = async function downloadLibrasvideo(req, res, next) {
	next(createError(404));
}

export { videoMaker, videoStatus, videoDownload };
