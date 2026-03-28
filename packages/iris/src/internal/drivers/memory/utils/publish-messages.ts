import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch";
import type { MemorySharedState, PublishMessagesOptions } from "../types/memory-store";
import { dispatchToConsumers } from "./dispatch-to-consumers";
import { dispatchToSubscribers } from "./dispatch-to-subscribers";

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
