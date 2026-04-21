import type { ConsumeMessage } from "amqplib";
import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import { IrisTransportError } from "../../../../errors/IrisTransportError.js";
import type { ConsumeStrategies } from "../../../types/consume-strategies.js";
import {
  consumeMessageCore,
  type ConsumerCallbackHost,
} from "../../../utils/consume-message-core.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { buildAmqpHeaders } from "./build-amqp-headers.js";
import { buildRabbitEnvelope } from "./build-rabbit-envelope.js";
import { parseAmqpHeaders } from "./parse-amqp-headers.js";
import { publishToExchange } from "./publish-to-exchange.js";
import { sanitizeRoutingKey } from "./sanitize-routing-key.js";

export type RabbitConsumerCallbackHost<M extends IMessage> = ConsumerCallbackHost<M>;

export const wrapRabbitConsumer = <M extends IMessage>(
  host: RabbitConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  state: RabbitSharedState,
  metadata: MessageMetadata,
  logger: ILogger,
): ((msg: ConsumeMessage | null) => Promise<void>) => {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const channel = state.consumeChannel;
    if (!channel) return;

    const parsed = parseAmqpHeaders(msg);
    const envelope = buildRabbitEnvelope(parsed, metadata);

    const strategies: ConsumeStrategies = {
      onExpired: async () => {
        channel.ack(msg);
      },
      onDeserializationError: async () => {
        if (metadata.deadLetter) {
          channel.nack(msg, false, false);
        } else {
          logger.error(
            "Deserialization error, discarding message (no dead letter configured)",
            {
              topic: envelope.topic,
            },
          );
          channel.ack(msg);
        }
      },
      retry: async (retryEnvelope: IrisEnvelope, _topic: string, retryDelay: number) => {
        if (!state.publishChannel) {
          throw new IrisTransportError("Publish channel unavailable during retry");
        }

        const routingKey = sanitizeRoutingKey(envelope.topic);
        const delayQueueName = `${state.exchange}.delay.${routingKey}`;

        if (!state.assertedDelayQueues.has(delayQueueName)) {
          await state.publishChannel.assertQueue(delayQueueName, {
            durable: true,
            deadLetterExchange: state.exchange,
            deadLetterRoutingKey: routingKey,
            arguments: {},
          });
          state.assertedDelayQueues.add(delayQueueName);
        }

        const { properties } = buildAmqpHeaders(retryEnvelope, parsed.headers, {
          persistent: true,
          type: metadata.message.name,
        });
        properties.expiration = String(retryDelay);

        await publishToExchange(
          state.publishChannel,
          "",
          delayQueueName,
          parsed.payload,
          properties,
        );

        channel.ack(msg);
      },
      onRetryFailed: async () => {
        channel.nack(msg, false, false);
      },
      deadLetter: async (_env: IrisEnvelope, _topic: string, err: Error) => {
        try {
          const dlxHeaders = {
            ...msg.properties.headers,
            "x-iris-error": err.message,
            "x-iris-error-timestamp": String(Date.now()),
          };
          const dlxProperties = {
            ...msg.properties,
            headers: dlxHeaders,
          };
          await publishToExchange(
            state.publishChannel!,
            state.dlxExchange,
            sanitizeRoutingKey(envelope.topic),
            parsed.payload,
            dlxProperties,
          );
          channel.ack(msg);
        } catch (dlxError) {
          logger.error("Failed to publish to DLX, nacking", { error: dlxError });
          channel.nack(msg, false, false);
        }
      },
      onExhaustedNoDeadLetter: async () => {
        channel.ack(msg);
      },
      onSuccess: async () => {
        channel.ack(msg);
      },
    };

    await consumeMessageCore(envelope, {
      host,
      callback,
      metadata,
      logger,
      strategies,
      inFlightCounter: {
        increment: () => {
          state.inFlightCount++;
        },
        decrement: () => {
          state.inFlightCount--;
        },
      },
    });
  };
};
