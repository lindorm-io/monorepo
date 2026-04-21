import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type {
  PublishRedisMessagesOptions,
  RedisSharedState,
} from "../types/redis-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch.js";
import { resolveStreamKey } from "./resolve-stream-key.js";
import { serializeStreamFields } from "./serialize-stream-fields.js";
import { xaddToStream } from "./xadd-to-stream.js";

export type RedisPublishDriver<M extends IMessage> = PublishDriverLike<M>;

export type { PublishRedisMessagesOptions };

export const publishRedisMessages = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: RedisPublishDriver<M>,
  state: RedisSharedState,
  _logger: ILogger,
  publishOptions?: PublishRedisMessagesOptions,
): Promise<void> => {
  if (!state.publishConnection) {
    throw new IrisPublishError("Redis connection not available");
  }

  const prepared = await preparePublishBatch(messages, options, driver);

  for (const { message, envelope, topic, delayed, delay } of prepared) {
    if (delayed && publishOptions?.delayManager) {
      await publishOptions.delayManager.schedule(envelope, topic, delay);
    } else {
      // Route broadcast messages to a separate broadcast stream so each
      // consumer's unique group receives them independently. Non-broadcast
      // messages go to the shared stream for competing-consumer distribution.
      const baseKey = resolveStreamKey(state.prefix, topic);
      const streamKey = envelope.broadcast ? `${baseKey}:broadcast` : baseKey;
      const fields = serializeStreamFields(envelope);

      await xaddToStream(
        state.publishConnection,
        streamKey,
        fields,
        state.maxStreamLength,
      );
      state.publishedStreams.add(streamKey);
    }

    await driver.completePublish(message);
  }
};
