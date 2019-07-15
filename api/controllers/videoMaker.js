import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';
import setupConnection from '../helpers/queueConnection';
import env from '../config/environments/environment';
import { CHANNEL_CLOSE_TIMEOUT, VIDEOGENERATION_TIMEOUT } from '../config/timeout';
import { VIDEOGENERATION_MESSAGE_TTL } from '../config/timeout';
import { VIDEOMAKER_CORE_ERROR } from '../config/error';
import { STATUS } from '../config/video';
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
			return next(createError(500, VIDEOMAKER_CORE_ERROR.unavailable));
		}

		const videoGenRequest = new Video({
			gloss: req.body.gloss,
			uid: uid,
			status: STATUS.queued,
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		const videoParams = { avatar: req.body.avatar };

		const payload = JSON.stringify({ gloss: req.body.gloss, options: videoParams });

		await connectionChannel.publish(
			'',
			env.VIDEOMAKER_QUEUE,
			Buffer.from(payload),
			{ correlationId: uid, expiration: VIDEOGENERATION_MESSAGE_TTL }
		);

		setTimeout(() => { 
			try {
				connectionChannel.close();

			} catch (channelAlreadyClosedError) {}

		 }, CHANNEL_CLOSE_TIMEOUT);

		await videoGenRequest.save();

		setTimeout(() => {
			const query = { uid: uid, status: { $ne: STATUS.generated } };
			const update = { $set: { status: STATUS.failed } };

			try {
				Video.findOneAndUpdate(query, update).exec();
			} catch (mongoNetworkError) {}

		 }, VIDEOGENERATION_TIMEOUT);

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
			const { status, size, expired } = await Video.findOne(query).exec() || {};

			if (status === undefined) {
				return next(createError(404, VIDEOMAKER_CORE_ERROR.processNotFound));
			}

			const videoStatus = expired === true
				? { status: STATUS.expired }
				: { status: status, ...(size && { size: size }) }

			res.status(200).json(videoStatus);

	} catch (error) {
		next(error);
	}

}

const videoDownload = async function downloadLibrasvideo(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
			const query = { uid: req.params.requestUID };
			const { status, path, expired } = await Video.findOne(query).exec() || {};

			if (status === undefined) {
				return next(createError(404, VIDEOMAKER_CORE_ERROR.videoNotFound));
			}

			if (status !== STATUS.generated || path === undefined) {
				return next(createError(404, VIDEOMAKER_CORE_ERROR.videoNotGenerated));
			}

			if (expired === true) {
				return next(createError(404, VIDEOMAKER_CORE_ERROR.videoExpired));
			}

			res.status(200).download(path, 'vlibrasvideo.mp4');

	} catch (error) {
		next(error);
	}

}

export { videoMaker, videoStatus, videoDownload };
