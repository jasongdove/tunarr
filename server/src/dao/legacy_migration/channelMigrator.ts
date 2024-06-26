import { Channel, Program, Watermark } from '@tunarr/types';
import dayjs from 'dayjs';
import ld, {
  compact,
  difference,
  get,
  isUndefined,
  map,
  values,
  every,
  reduce,
  keys,
} from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'path';
import { v4 } from 'uuid';
import createLogger from '../../logger.js';
import { Maybe } from '../../types.js';
import {
  createDirectoryIfNotExists,
  emptyStringToUndefined,
  groupByUniqAndMap,
  isNodeError,
  isNonEmptyString,
  mapAsyncSeq,
} from '../../util/index.js';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import { getEm } from '../dataSource.js';
import {
  ContentItem,
  Lineup,
  LineupItem,
  OfflineItem,
  RedirectItem,
} from '../derived_types/Lineup.js';
import { Channel as ChannelEntity } from '../entities/Channel.js';
import { ChannelFillerShow } from '../entities/ChannelFillerShow.js';
import { CustomShow as CustomShowEntity } from '../entities/CustomShow.js';
import { FillerShowId } from '../entities/FillerShow.js';
import {
  Program as ProgramEntity,
  programTypeFromString,
} from '../entities/Program.js';
import {
  JSONArray,
  JSONObject,
  convertRawProgram,
  tryParseResolution,
  uniqueProgramId,
} from './migrationUtil.js';
import { ChannelDB } from '../channelDb.js';

const logger = createLogger(import.meta);

const validWatermarkPositions = [
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
];

export type LegacyProgram = Omit<Program, 'channel'> & {
  isOffline: boolean;
  channel: number;
  ratingKey?: string;
};

export async function createLineup(
  rawPrograms: LegacyProgram[],
  dbProgramById: Record<string, ProgramEntity>,
): Promise<Lineup> {
  const channels = await getEm()
    .repo(ChannelEntity)
    .findAll({ populate: ['uuid', 'number'] });
  const channelIdsByNumber = groupByUniqAndMap(
    channels,
    'number',
    (c) => c.uuid,
  );

  const lineupItems: LineupItem[] = ld
    .chain(rawPrograms)
    .map((program) => {
      if (
        program.type &&
        ['movie', 'episode', 'track'].includes(program.type)
      ) {
        const dbProgram = dbProgramById[uniqueProgramId(program)];
        if (!isUndefined(dbProgram)) {
          // Content type
          return {
            type: 'content',
            id: dbProgram.uuid,
            durationMs: program.duration,
          } as ContentItem;
        }
      } else if (program.type === 'redirect') {
        return {
          type: 'redirect',
          channel: channelIdsByNumber[program.channel],
          durationMs: program.duration,
        } as RedirectItem;
      } else if (program.isOffline) {
        return {
          type: 'offline',
          durationMs: program.duration,
        } as OfflineItem;
      }

      return;
    })
    .compact()
    .value();

  return {
    items: lineupItems,
  };
}

// Migrates programs for a channel. The channel must already be persisted to the DB
export async function migratePrograms(fullPath: string) {
  const channelFileContents = await fs.readFile(fullPath);

  const parsed = JSON.parse(
    channelFileContents.toString('utf-8'),
  ) as JSONObject;

  const channelNumber = parsed['number'] as number;

  const em = getEm();

  const channelEntity = await em
    .repo(ChannelEntity)
    .findOneOrFail({ number: channelNumber });

  const fallbackPrograms = ((parsed['fallback'] as Maybe<JSONArray>) ?? []).map(
    convertRawProgram,
  );

  // We don't filter out uniques yet because we will use this
  // array to create the 'raw' lineup, which can contain dupes
  const programs = ld
    .chain((parsed['programs'] as JSONArray) ?? [])
    .map(convertRawProgram)
    .filter(
      (p) =>
        isNonEmptyString(p.serverKey) &&
        isNonEmptyString(p.ratingKey) &&
        isNonEmptyString(p.key),
    )
    .value();

  const programEntities = ld
    .chain(programs)
    .uniqBy(uniqueProgramId)
    .map(createProgramEntity)
    .compact()
    .value();

  logger.debug('Upserting %d programs from legacy DB', programEntities.length);

  const dbProgramById = reduce(
    await em.upsertMany(ProgramEntity, programEntities, {
      batchSize: 25,
      onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
      onConflictAction: 'merge',
      onConflictExcludeFields: ['uuid'],
    }),
    (prev, curr) => ({
      ...prev,
      [`${curr.externalSourceId}|${curr.externalKey}`]: curr,
    }),
    {} as Record<string, ProgramEntity>,
  );

  logger.debug(
    'Upserted %d programs from legacy DB',
    keys(dbProgramById).length,
  );

  const customShowIds = await em
    .repo(CustomShowEntity)
    .findAll({ populate: ['uuid'] });

  const customShowRefs = ld
    .chain(programs)
    .flatMap((p) => p.customShowId)
    .compact()
    .uniq()
    .value();

  const missingIds = difference(
    customShowRefs,
    map(customShowIds, (cs) => cs.uuid),
  );
  if (missingIds.length > 0) {
    logger.warn(
      'There are custom show IDs that are not found in the DB: %O',
      missingIds,
    );
  }

  // Associate the programs with the channel
  channelEntity.programs.removeAll();
  channelEntity.customShows.removeAll();

  // Update associations from custom show <-> channel
  channelEntity.customShows.add(
    customShowRefs.map((id) => em.getReference(CustomShowEntity, id)),
  );

  // Update associations from program <-> channel
  channelEntity.programs.set(
    values(dbProgramById).map((id) => em.getReference(ProgramEntity, id.uuid)),
  );

  logger.debug('Saving channel %s', channelEntity.uuid);
  await em.persistAndFlush(channelEntity);

  logger.debug('Saving channel lineup %s', channelEntity.uuid);
  const channelDB = new ChannelDB();
  await channelDB.saveLineup(
    channelEntity.uuid,
    await createLineup(programs, dbProgramById),
  );

  return {
    legacyPrograms: programs,
    legacyFallback: fallbackPrograms,
    persistedPrograms: values(dbProgramById),
    persistedFallbacks: [],
  };
}

export async function migrateChannel(fullPath: string): Promise<{
  raw: Omit<Channel, 'programs' | 'fallback'>;
  entity: ChannelEntity;
}> {
  logger.info('Migrating channel file: ' + fullPath);
  const channelFileContents = await fs.readFile(fullPath);

  const parsed = JSON.parse(
    channelFileContents.toString('utf-8'),
  ) as JSONObject;

  const transcodingOptions = get(
    parsed,
    'transcoding.targetResolution',
  ) as Maybe<string>;
  const hasTranscodingOptions = !isUndefined(
    emptyStringToUndefined(transcodingOptions),
  );

  const watermark = parsed['watermark'] as JSONObject;

  const channel = {
    id: v4(),
    disableFillerOverlay: parsed['disableFillerOverlay'] as boolean,
    duration: parsed['duration'] as number,
    // fallback: ((parsed['fallback'] as Maybe<JSONArray>) ?? []).map(
    // convertProgram,
    // ),
    groupTitle: parsed['groupTitle'] as string,
    guideMinimumDuration:
      (parsed['guideMinimumDurationSeconds'] as number) * 1000,
    icon: {
      path: parsed['icon'] as string,
      duration: parsed['iconDuration'] as number,
      position: parsed['iconPosition'] as string,
      width: parsed['iconWidth'] as number,
    },
    startTime: dayjs(parsed['startTime'] as string).unix() * 1000,
    name: parsed['name'] as string,
    offline: {
      picture: parsed['offlinePicture'] as string,
      soundtrack: emptyStringToUndefined(parsed['offlineSoundtrack'] as string),
      mode: parsed['offlineMode'] as 'clip' | 'pic',
    },
    transcoding:
      hasTranscodingOptions &&
      !isUndefined(tryParseResolution(transcodingOptions))
        ? {
            targetResolution: tryParseResolution(transcodingOptions)!,
          }
        : undefined,
    number: parsed['number'] as number,
    fillerCollections: ((parsed['fillerCollections'] as JSONArray) ?? []).map(
      (fc) => {
        return {
          id: fc!['id'] as string,
          weight: fc!['weight'] as number,
          cooldownSeconds: fc!['cooldown'] / 1000,
        };
      },
    ),
    watermark: !isUndefined(watermark)
      ? {
          enabled: watermark['enabled'] as boolean,
          duration: watermark['duration'] as number,
          position:
            isNonEmptyString(watermark['position']) &&
            validWatermarkPositions.includes(watermark['position'])
              ? (watermark['position'] as Watermark['position'])
              : 'bottom-right',
          width: watermark['width'] as number,
          verticalMargin: watermark['verticalMargin'] as number,
          horizontalMargin: watermark['horizontalMargin'] as number,
          url: watermark['url'] as Maybe<string>,
          animated: isUndefined(watermark['animated'])
            ? false
            : (watermark['animated'] as boolean),
          fixedSize: watermark['fixedSize'] as boolean,
        }
      : undefined,
    stealth: isUndefined(parsed['stealth'])
      ? false
      : (parsed['stealth'] as boolean),
    guideFlexTitle: emptyStringToUndefined(
      parsed['guideFlexPlaceholder'] as string,
    ),
  };

  const em = getEm();

  let channelEntity: ChannelEntity;
  const existingEntity = await em.findOne(
    ChannelEntity,
    {
      number: channel.number,
    },
    { populate: ['programs', 'customShows'] },
  );

  if (existingEntity) {
    channelEntity = existingEntity;
    em.assign(channelEntity, {
      disableFillerOverlay: channel.disableFillerOverlay,
      groupTitle: channel.groupTitle,
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      startTime: channel.startTime,
      stealth: channel.stealth,
      transcoding: channel.transcoding,
      watermark: channel.watermark,
      offline: { mode: 'clip' },
      guideMinimumDuration: channel.guideMinimumDuration,
    });
  } else {
    channelEntity = em.create(ChannelEntity, {
      duration: channel.duration,
      disableFillerOverlay: channel.disableFillerOverlay,
      groupTitle: channel.groupTitle,
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      startTime: channel.startTime,
      stealth: channel.stealth,
      transcoding: channel.transcoding,
      watermark: channel.watermark,
      offline: { mode: 'clip' },
      guideMinimumDuration: channel.guideMinimumDuration,
    });
  }

  const entity = await em.upsert(ChannelEntity, channelEntity, {
    onConflictFields: ['number'],
    onConflictAction: 'ignore',
  });

  // Init programs, we may have already inserted some
  entity.programs.removeAll();
  entity.customShows.removeAll();

  logger.info('Saving channel');
  await em.persistAndFlush(entity);

  await migratePrograms(fullPath);

  return { raw: channel, entity };
}

export async function migrateChannels(dbPath: string) {
  const channelLineupsPath = path.resolve(dbPath, 'channel-lineups');
  await createDirectoryIfNotExists(channelLineupsPath);

  const channelsBackupPath = path.resolve(dbPath, 'channels-backup');

  let backupExists = false;

  try {
    await fs.mkdir(channelsBackupPath);
  } catch (e) {
    if (isNodeError(e) && e.code !== 'EEXIST') {
      logger.error('Error', e);
      return;
    } else {
      backupExists = (await fs.readdir(channelsBackupPath)).length > 0;
    }
  }

  const channelPath = path.resolve(dbPath, 'channels');

  logger.info(`Using channel directory: ${channelPath}`);

  const channelFiles = await fs.readdir(channelPath);

  logger.info(`Found channels: ${channelFiles.join(', ')}`);

  const migratedChannels = compact(
    await mapAsyncSeq(channelFiles, async (channel) => {
      try {
        // Create a backup of the channel file
        const fullPath = path.join(channelPath, channel);
        if (!backupExists) {
          logger.info('Creating channel backup...');
          await fs.copyFile(
            fullPath,
            path.join(channelsBackupPath, channel + '.bak'),
          );
        }
        return await migrateChannel(fullPath);
      } catch (e) {
        logger.error(`Unable to migrate channel ${channel}`, e);
        return;
      }
    }),
  );

  // Create filler associations
  const em = getEm();
  await mapAsyncSeq(migratedChannels, async ({ raw: channel, entity }) => {
    const fillers = channel.fillerCollections ?? [];
    const relations = map(fillers, (filler) => {
      const cfs = em.create(ChannelFillerShow, {
        channel: entity.uuid,
        fillerShow: filler.id as FillerShowId,
        weight: filler.weight,
        cooldown: filler.cooldownSeconds,
      });
      return cfs;
    });

    await em.upsertMany(ChannelFillerShow, relations, {
      onConflictAction: 'ignore',
    });

    return em.flush();
  });

  return migratedChannels;
}

export function createProgramEntity(program: LegacyProgram) {
  if (
    ['movie', 'episode', 'track'].includes(program.type ?? '') &&
    every([program.ratingKey, program.serverKey, program.key], isNonEmptyString)
  ) {
    const dbProgram = new ProgramEntity();
    dbProgram.duration = program.duration;
    dbProgram.sourceType = ProgramSourceType.PLEX;
    dbProgram.episode = program.episode;
    dbProgram.filePath = program.file;
    dbProgram.icon = program.icon;
    dbProgram.externalKey = program.ratingKey!;
    dbProgram.plexRatingKey = program.key!;
    dbProgram.plexFilePath = program.plexFile;
    dbProgram.externalSourceId = program.serverKey!;
    dbProgram.showTitle = program.showTitle;
    dbProgram.summary = program.summary;
    dbProgram.title = program.title!;
    // This is checked above
    dbProgram.type = programTypeFromString(program.type)!;
    dbProgram.episode = program.episode;
    dbProgram.seasonNumber = program.season;
    dbProgram.seasonIcon = program.seasonIcon;
    dbProgram.showIcon = program.showIcon;
    dbProgram.originalAirDate = program.date;
    dbProgram.rating = program.rating;
    dbProgram.year = program.year;
    return dbProgram;
  }

  return;
}

export async function persistProgram(program: LegacyProgram) {
  const em = getEm();
  const dbProgram = createProgramEntity(program);

  if (!isUndefined(dbProgram)) {
    return em.upsert(ProgramEntity, dbProgram, {
      onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
      onConflictAction: 'merge',
      onConflictExcludeFields: ['uuid'],
    });
  }

  return;
}
