import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { NatsSharedState, PublishNatsMessagesOptions } from "../types/nats-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch.js";
import { resolveSubject } from "./resolve-subject.js";
import { serializeNatsMessage } from "./serialize-nats-message.js";

export type NatsPublishDriver<M extends IMessage> = PublishDriverLike<M>;

export type { PublishNatsMessagesOptions };

export const publishNatsMessages = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: NatsPublishDriver<M>,
  state: NatsSharedState,
  _logger: ILogger,
  publishOptions?: PublishNatsMessagesOptions,
): Promise<void> => {
  if (!state.js || !state.headersInit) {
    throw new IrisPublishError("NATS JetStream connection not available");
  }

  const prepared = await preparePublishBatch(messages, options, driver);

  for (const { message, envelope, topic, delayed, delay } of prepared) {
    if (delayed && publishOptions?.delayManager) {
      await publishOptions.delayManager.schedule(envelope, topic, delay);
    } else {
      // Broadcast messages use a separate subject so each consumer's unique
      // ephemeral consumer receives them independently.
      const baseSubject = resolveSubject(state.prefix, topic);
      const subject = envelope.broadcast ? `${baseSubject}.broadcast` : baseSubject;
      const { data } = serializeNatsMessage(envelope, state.headersInit);

      await state.js.publish(subject, data);
    }

    await driver.completePublish(message);
  }
};
