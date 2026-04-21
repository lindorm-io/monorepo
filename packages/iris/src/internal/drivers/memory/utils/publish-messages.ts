import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch.js";
import type { MemorySharedState, PublishMessagesOptions } from "../types/memory-store.js";
import { dispatchToConsumers } from "./dispatch-to-consumers.js";
import { dispatchToSubscribers } from "./dispatch-to-subscribers.js";

export type PublishDriver<M extends IMessage> = PublishDriverLike<M>;

export type { PublishMessagesOptions };

export const publishMessages = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: PublishDriver<M>,
  store: MemorySharedState,
  publishOptions?: PublishMessagesOptions,
): Promise<void> => {
  const prepared = await preparePublishBatch(messages, options, driver);

  for (const { message, envelope, delayed, delay } of prepared) {
    if (delayed && publishOptions?.delayManager) {
      await publishOptions.delayManager.schedule(envelope, envelope.topic, delay);
    } else {
      await dispatchToSubscribers(store, envelope);
      await dispatchToConsumers(store, envelope);
    }

    await driver.completePublish(message);
  }
};
