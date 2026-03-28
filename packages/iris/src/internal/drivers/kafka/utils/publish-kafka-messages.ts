import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import type { KafkaSharedState, PublishKafkaMessagesOptions } from "../types/kafka-types";
import { IrisPublishError } from "../../../../errors/IrisPublishError";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch";
import { ensureKafkaTopicFromState } from "./ensure-kafka-topic";
import { resolveTopicName } from "./resolve-topic-name";
import { serializeKafkaMessage } from "./serialize-kafka-message";

export type KafkaPublishDriver<M extends IMessage> = PublishDriverLike<M>;

export type { PublishKafkaMessagesOptions };

export const publishKafkaMessages = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: KafkaPublishDriver<M>,
  state: KafkaSharedState,
  _logger: ILogger,
  publishOptions?: PublishKafkaMessagesOptions,
): Promise<void> => {
  if (!state.producer) {
    throw new IrisPublishError("Kafka producer not available");
  }

  const prepared = await preparePublishBatch(messages, options, driver);

  for (const { message, envelope, topic, delayed, delay } of prepared) {
    if (delayed && publishOptions?.delayManager) {
      await publishOptions.delayManager.schedule(envelope, topic, delay);
    } else {
      // Route broadcast messages to a separate broadcast topic so each
      // consumer's unique group receives them independently. Non-broadcast
      // messages go to the shared topic for competing-consumer distribution.
      const baseTopic = resolveTopicName(state.prefix, topic);
      const topicName = envelope.broadcast ? `${baseTopic}.broadcast` : baseTopic;

      await ensureKafkaTopicFromState(state, topicName, _logger);

      const kafkaMessage = serializeKafkaMessage(envelope);

      await state.producer.send({
        topic: topicName,
        messages: [kafkaMessage],
        acks: state.acks,
      });
      state.publishedTopics.add(topicName);
    }

    await driver.completePublish(message);
  }
};
