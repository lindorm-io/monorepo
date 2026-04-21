import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import {
  preparePublishBatch,
  type PublishDriverLike,
} from "../../../utils/prepare-publish-batch.js";
import { buildAmqpHeaders } from "./build-amqp-headers.js";
import { publishToExchange } from "./publish-to-exchange.js";
import { resolveQueueName } from "./resolve-queue-name.js";
import { sanitizeRoutingKey } from "./sanitize-routing-key.js";

export type RabbitPublishDriver<M extends IMessage> = PublishDriverLike<M>;

export const publishRabbitMessages = async <M extends IMessage>(
  messages: M | Array<M>,
  options: PublishOptions | undefined,
  driver: RabbitPublishDriver<M>,
  state: RabbitSharedState,
  _logger: ILogger,
): Promise<void> => {
  if (!state.publishChannel) {
    throw new IrisPublishError("Publish channel not available");
  }

  const prepared = await preparePublishBatch(messages, options, driver);

  for (const { message, envelope, outbound, topic, delayed, delay } of prepared) {
    const routingKey = sanitizeRoutingKey(topic);

    const { properties } = buildAmqpHeaders(envelope, outbound.headers, {
      persistent: driver.metadata.persistent,
      type: driver.metadata.message.name,
      mandatory: false,
    });

    if (delayed) {
      const delayQueueName = resolveQueueName({
        exchange: state.exchange,
        topic,
        type: "delay",
      })!;

      if (!state.assertedDelayQueues.has(delayQueueName)) {
        await state.publishChannel.assertQueue(delayQueueName, {
          durable: true,
          deadLetterExchange: state.exchange,
          deadLetterRoutingKey: routingKey,
          arguments: {},
        });
        state.assertedDelayQueues.add(delayQueueName);
      }

      const delayProperties = { ...properties, expiration: String(delay) };
      await publishToExchange(
        state.publishChannel,
        "",
        delayQueueName,
        outbound.payload,
        delayProperties,
      );
    } else {
      await publishToExchange(
        state.publishChannel,
        state.exchange,
        routingKey,
        outbound.payload,
        properties,
      );
    }

    await driver.completePublish(message);
  }
};
