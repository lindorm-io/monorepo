import { randomUUID } from "@lindorm/random";
import type {
  CreateNatsConsumerOptions,
  NatsConsumerLoop,
  NatsConsumerMessages,
} from "../types/nats-types.js";

export type { CreateNatsConsumerOptions };

export const createNatsConsumer = async (
  options: CreateNatsConsumerOptions,
): Promise<NatsConsumerLoop> => {
  const {
    js,
    jsm,
    streamName,
    consumerName,
    subject,
    prefetch,
    onMessage,
    logger,
    ensuredConsumers,
    deliverPolicy = "new",
  } = options;

  const consumerTag = randomUUID();

  // Ensure the durable consumer exists
  if (!ensuredConsumers.has(consumerName)) {
    try {
      await jsm.consumers.add(streamName, {
        durable_name: consumerName,
        name: consumerName,
        ack_policy: "explicit",
        deliver_policy: deliverPolicy,
        filter_subject: subject,
        max_ack_pending: prefetch,
        inactive_threshold: 300_000_000_000, // 5 minutes in nanoseconds
      });
      ensuredConsumers.add(consumerName);
    } catch (err: any) {
      // Consumer may already exist — if the config matches, that's fine
      if (!String(err?.message).includes("already in use")) {
        throw err;
      }
      ensuredConsumers.add(consumerName);
    }
  }

  const abortController = new AbortController();
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  // Shared ref so the loop object can be updated after consume() resolves.
  // The loop is returned synchronously before the async IIFE starts.
  const messagesRef: { current: NatsConsumerMessages | null } = { current: null };

  const loopPromise = (async (): Promise<void> => {
    try {
      const consumer = await js.consumers.get(streamName, consumerName);
      const messages = await consumer.consume({
        max_messages: prefetch,
        idle_heartbeat: 5000,
      });
      messagesRef.current = messages;

      resolveReady();

      for await (const msg of messages) {
        if (abortController.signal.aborted) break;

        try {
          await onMessage(msg);
        } catch (error) {
          if (abortController.signal.aborted) break;

          logger.error("Consumer message handler failed", {
            error: error instanceof Error ? error.message : String(error),
            subject,
            consumerName,
          });
        }
        // NOTE: ack/nak/term is handled by the onMessage callback (wrapNatsConsumer),
        // NOT here. The wrap consumer calls msg.ack() on success, msg.nak(delay) on
        // retry, and msg.term() on dead letter — all native NATS.
      }
    } catch (error) {
      if (abortController.signal.aborted) return;

      logger.error("Consumer loop error", {
        error: error instanceof Error ? error.message : String(error),
        subject,
        consumerName,
      });
    } finally {
      resolveReady();
    }
  })();

  const loop: NatsConsumerLoop = {
    consumerTag,
    streamName,
    consumerName,
    subject,
    get messages() {
      return messagesRef.current;
    },
    abortController,
    loopPromise,
    ready,
  };

  return loop;
};
