import { FastifyReply, FastifyRequest } from 'fastify';
import { isNil, isUndefined } from 'lodash-es';
import * as fsSync from 'node:fs';
import { Readable } from 'stream';
import { z } from 'zod';
import { FfmpegText } from '../ffmpegText.js';
import { serverOptions } from '../globals.js';
import createLogger from '../logger.js';
import { ConcatStream } from '../stream/ConcatStream.js';
import { VideoStream } from '../stream/VideoStream.js';
import { StreamQueryStringSchema, TruthyQueryParam } from '../types/schemas.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';

const logger = createLogger(import.meta);

let StreamCount = 0;

// eslint-disable-next-line @typescript-eslint/require-await
export const videoRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get('/setup', async (req, res) => {
    const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
    // Check if ffmpeg path is valid
    if (!fsSync.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );

      return res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
    }

    logger.info(`\r\nStream starting. Channel: 1 (Tunarr)`);

    const ffmpeg = new FfmpegText(
      ffmpegSettings,
      'Tunarr (No Channels Configured)',
      'Configure your channels using the Tunarr Web UI',
    );

    const buffer = new Readable();
    buffer._read = () => {};

    ffmpeg.on('data', (data) => {
      buffer.push(data);
    });

    ffmpeg.on('error', (err) => {
      logger.error('FFMPEG ERROR', err);
      buffer.push(null);
      void res.status(500).send('FFMPEG ERROR');
      return;
    });

    ffmpeg.on('close', () => {
      buffer.push(null);
    });

    res.raw.on('close', () => {
      // on HTTP close, kill ffmpeg
      ffmpeg.kill();
      logger.info(`\r\nStream ended. Channel: 1 (Tunarr)`);
    });

    return res.send(buffer);
  });

  fastify.get(
    '/video',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const result = await new ConcatStream().startStream(
        req.query.channel,
        false,
      );
      if (result.type === 'error') {
        return res.send(result.httpStatus).send(result.message);
      }

      req.raw.on('close', () => {
        result.stop();
      });

      return res.header('Content-Type', 'video/mp2t').send(result.stream);
    },
  );

  fastify.get(
    '/radio',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string()),
        }),
      },
    },
    async (req, res) => {
      const result = await new ConcatStream().startStream(
        req.query.channel,
        false,
      );
      if (result.type === 'error') {
        return res.send(result.httpStatus).send(result.message);
      }

      req.raw.on('close', () => {
        result.stop();
      });

      return res.header('Content-Type', 'video/mp2t').send(result.stream);
    },
  );

  fastify.get(
    '/stream',
    {
      schema: {
        querystring: StreamQueryStringSchema,
      },
      onError(req, _, e) {
        logger.error('Error on /stream: %s. %O', req.raw.url, e);
      },
    },
    async (req, res) => {
      const t0 = new Date().getTime();
      const videoStream = new VideoStream();
      const rawStreamResult = await videoStream.startStream(
        req.query,
        t0,
        true,
      );

      if (rawStreamResult.type === 'error') {
        logger.error(
          'Error starting stream! Message: %s, Error: %O',
          rawStreamResult.message,
          rawStreamResult.error ?? null,
        );
        return res
          .status(rawStreamResult.httpStatus)
          .send(rawStreamResult.message);
      }

      req.raw.on('close', () => {
        logger.debug('Client closed video stream, stopping it now.');
        // TODO if HLS stream, check the session to see if we can cleana it up
        rawStreamResult.stop();
      });

      return res
        .header('Content-Type', 'video/mp2t')
        .send(rawStreamResult.stream);
    },
  );

  fastify.get(
    '/m3u8',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().or(z.string().uuid()),
        }),
      },
    },
    async (req, res) => {
      const sessionId = StreamCount++;

      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(400).send('No Channel Specified');
      }

      if (isNil(await req.serverCtx.channelDB.getChannel(req.query.channel))) {
        return res.status(404).send("Channel doesn't exist");
      }

      return res
        .type('application/x-mpegURL')
        .send(
          await req.serverCtx.m3uService.buildChannelM3U(
            req.protocol,
            req.hostname,
            req.query.channel,
            sessionId,
          ),
        );
    },
  );

  fastify.get(
    '/playlist',
    {
      schema: {
        querystring: z.object({
          channel: z.coerce.number().optional(),
          audioOnly: TruthyQueryParam.optional().default('0'),
          hls: TruthyQueryParam.default('0'),
        }),
      },
    },
    async (req, res) => {
      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(400).send('No Channel Specified');
      }

      if (isNil(await req.serverCtx.channelDB.getChannel(req.query.channel))) {
        return res.status(404).send("Channel doesn't exist");
      }

      let data = 'ffconcat version 1.0\n';

      const sessionId = StreamCount++;
      const audioOnly = req.query.audioOnly;

      // We're disabling the loading screen for now.
      // loading screen is pointless in audio mode (also for some reason it makes it fail when codec is aac, and I can't figure out why)
      // if (
      //   ffmpegSettings.enableTranscoding &&
      //   ffmpegSettings.normalizeVideoCodec &&
      //   ffmpegSettings.normalizeAudioCodec &&
      //   ffmpegSettings.normalizeResolution &&
      //   ffmpegSettings.normalizeAudio &&
      //   !audioOnly
      // ) {
      //   //loading screen
      //   data += `file 'http://localhost:${
      //     serverOptions().port
      //   }/stream?channel=${
      //     req.query.channel
      //   }&first=0&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      // }

      // data += `file 'http://localhost:${serverOptions().port}/stream?channel=${
      //   req.query.channel
      // }&first=1&session=${sessionId}&audioOnly=${audioOnly}'\n`;

      // We only need 2 entries + stream_loop on the concat command for an infinite
      // stream. See https://trac.ffmpeg.org/wiki/Concatenate#Changingplaylistfilesonthefly
      for (let i = 0; i < 2; i++) {
        data += `file 'http://localhost:${
          serverOptions().port
        }/stream?channel=${
          req.query.channel
        }&session=${sessionId}&audioOnly=${audioOnly}&hls=${req.query.hls}'\n`;
      }

      return res.type('text').send(data);
    },
  );

  const mediaPlayer = async (
    channelNum: number,
    path: string,
    req: FastifyRequest,
    res: FastifyReply,
  ) => {
    if (isNil(await req.serverCtx.channelDB.getChannel(channelNum))) {
      return res.status(404).send("Channel doesn't exist");
    }

    const content = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-ALLOW-CACHE:YES',
      '#EXT-X-TARGETDURATION:60',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `${req.protocol}://${req.hostname}/${path}?channel=${channelNum}`,
    ];

    return res
      .type('video/x-mpegurl')
      .status(200)
      .send(content.join('\n') + '\n');
  };

  fastify.get(
    '/media-player/:number.m3u',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
        querystring: z.object({
          fast: TruthyQueryParam.optional(),
        }),
      },
    },
    async (req, res) => {
      try {
        let path = 'video';
        if (req.query.fast) {
          path = 'm3u8';
        }
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify.get(
    '/media-player/radio/:number.m3u',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      try {
        const path = 'radio';
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );
};
