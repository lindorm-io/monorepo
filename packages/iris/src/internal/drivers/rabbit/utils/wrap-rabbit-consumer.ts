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
  queueName: string,
): ((msg: ConsumeMessage | null) => Promise<void>) => {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const channel = state.consumeChannel;
    if (!channel) return;

    const parsed = parseAmqpHeaders(msg);
    const envelope = buildRabbitEnvelope(parsed);

    // Dead-letter to the DLX explicitly (then ack the original), rather than
    // relying on a queue-level x-dead-letter-exchange. Consumer queues (worker,
    // stream) are not declared with a native DLX, so a bare `nack(requeue=false)`
    // would DROP the message instead of dead-lettering it. Publishing to the DLX
    // routes it to the same DLQ the retry-exhaustion path uses — observed once,
    // never looped, never dropped.
    const sendToDeadLetter = async (error: Error): Promise<void> => {
      try {
        const dlxHeaders = {
          ...msg.properties.headers,
          "x-iris-error": error.message,
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
    };

    const strategies: ConsumeStrategies = {
      onExpired: async () => {
        channel.ack(msg);
      },
      onDeserializationError: async (_env: IrisEnvelope, error: Error) => {
        if (metadata.deadLetter) {
          // A parse error is a poison pill: retrying is futile, so dead-letter it
          // straight away (once) — never loop, never silently drop.
          await sendToDeadLetter(error);
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
          throw new IrisTransportError("Publish channel unavailable during retry", {
            code: "retry_mechanism_unavailable",
            title: "Retry Mechanism Unavailable",
            details:
              "The message cannot be retried because the RabbitMQ publish channel is unavailable.",
            data: { driver: "rabbit" },
          });
        }

        // Per-CONSUMER-QUEUE delay queue (not per-topic): the retry must reach
        // ONLY the queue whose consumer failed, never every queue bound to the
        // exchange. After the TTL the message dead-letters to the DEFAULT
        // exchange ("") keyed by the failing queue's own name, which routes it
        // to exactly that one queue — matching the memory/nats "retry → failing
        // consumer only" contract, for both broadcast and non-broadcast types.
        // (Routing back to the main exchange on the original key fanned the
        // retry out to every bound queue — the M1 blast-radius bug.)
        const delayQueueName = `${state.exchange}.delay.${queueName}`;

        if (!state.assertedDelayQueues.has(delayQueueName)) {
          await state.publishChannel.assertQueue(delayQueueName, {
            durable: true,
            deadLetterExchange: "",
            deadLetterRoutingKey: queueName,
            arguments: {},
          });
          state.assertedDelayQueues.add(delayQueueName);
        }

        const { properties } = buildAmqpHeaders(retryEnvelope, parsed.headers, {
          persistent: true,
          type: metadata.message.name,
        });
        properties.expiration = String(retryDelay);

        // The topic normally rides the AMQP routing key, but dead-lettering from
        // the delay queue via the default exchange REWRITES the routing key to the
        // consumer's queue name (that's how the retry is targeted). Carry the real
        // topic on `x-iris-topic` so buildRabbitEnvelope recovers it on redelivery
        // — otherwise the redelivered envelope's topic becomes the queue name,
        // corrupting dead-letter routing and the delivered ConsumeEnvelope.
        properties.headers = {
          ...properties.headers,
          "x-iris-topic": envelope.topic,
        };

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
        await sendToDeadLetter(err);
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
