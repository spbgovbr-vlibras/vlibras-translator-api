import createError from 'http-errors';
import uuid from 'uuid/v4';
import env from '../../config/environments/environment';
import queueConnection from '../util/queueConnection';
import Video from './Video';
import VideoStatus from './VideoStatus';
import { VIDEOMAKER_ERROR } from '../../config/error';
import { VIDEO_STATUS } from '../../config/status';
import {
  CHANNEL_CLOSE_TIMEOUT,
  VIDEOGENERATION_TIMEOUT,
  VIDEOGENERATION_PAYLOAD_TTL,
} from '../../config/timeout';

const videoMaker = async function videoMakerController(req, res, next) {
  try {
    const uid = uuid();
    const AMQPConnection = await queueConnection();
    const AMQPChannel = await AMQPConnection.createChannel();

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.VIDEOMAKER_QUEUE,
      { durable: false },
    );

    if (consumerCount === 0) {
      return next(createError(500, VIDEOMAKER_ERROR.unavailable));
    }

    const videoGenRequest = new Video({
      gloss: req.body.gloss,
      uid,
      status: VIDEO_STATUS.queued,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    const videoStatus = new VideoStatus({
      status: VIDEO_STATUS.queued,
      duration: 0,
    });

    const videoParams = {
      avatar: req.body.avatar,
      caption: req.body.caption,
    };

    const payload = JSON.stringify({ gloss: req.body.gloss, playerOptions: videoParams });

    await AMQPChannel.publish(
      '',
      env.VIDEOMAKER_QUEUE,
      Buffer.from(payload),
      { correlationId: uid, expiration: VIDEOGENERATION_PAYLOAD_TTL },
    );

    setTimeout(() => {
      try {
        AMQPChannel.close();
      } catch (channelAlreadyClosedError) { /* empty */ }
    }, CHANNEL_CLOSE_TIMEOUT);

    await videoGenRequest.save();
    await videoStatus.save();

    setTimeout(async () => {
      const query = { uid, status: { $ne: VIDEO_STATUS.generated } };
      const update = { $set: { status: VIDEO_STATUS.failed } };


      // VER COM WESNYDY
      try {
        // update status for failed
        Video.findOneAndUpdate(query, update).exec();
        // const videoStatusFailed = new VideoStatus({
        //   status: VIDEO_STATUS.failed,
        // });
        // await videoStatusFailed.save();
      } catch (mongoNetworkError) { /* empty */ }
    }, VIDEOGENERATION_TIMEOUT);

    return res.status(200).json({ requestUID: uid });
  } catch (error) {
    return next(error);
  }
};

const videoStatus = async function videoStatusController(req, res, next) {
  try {
    const query = { uid: req.params.requestUID };
    const { status, size, expired } = await Video.findOne(query).exec() || {};

    if (status === undefined) {
      return next(createError(404, VIDEOMAKER_ERROR.processNotFound));
    }

    const librasVideoStatus = expired === true
      ? { status: VIDEO_STATUS.expired }
      : { status, ...(size && { size }) };

    return res.status(200).json(librasVideoStatus);
  } catch (error) {
    return next(error);
  }
};

const videoDownload = async function videoDownloadController(req, res, next) {
  try {
    const query = { uid: req.params.requestUID };
    const { status, path, expired } = await Video.findOne(query).exec() || {};

    if (status === undefined) {
      return next(createError(404, VIDEOMAKER_ERROR.videoNotFound));
    }

    if (status !== VIDEO_STATUS.generated || path === undefined) {
      return next(createError(404, VIDEOMAKER_ERROR.videoNotGenerated));
    }

    if (expired === true) {
      return next(createError(404, VIDEOMAKER_ERROR.videoExpired));
    }

    return res.status(200).download(path, 'vlibrasvideo.mp4');
  } catch (error) {
    return next(error);
  }
};

export {
  videoMaker,
  videoStatus,
  videoDownload,
};
