import type { ILogger } from "@lindorm/logger";
import type { KafkaSharedState } from "../types/kafka-types.js";
import {
  createKafkaConsumer,
  getOrCreatePooledConsumer,
} from "./create-kafka-consumer.js";
import { stopConsumerWithTimeout, stopKafkaConsumer } from "./stop-kafka-consumer.js";

// Re-establishes every registered Kafka consumer after a (re)connect.
//
// KafkaJS self-heals a consumer through transient broker blips, but a
// non-retriable crash (or exhausted retries) stops the consumer for good
// without restarting it — leaving the driver "connected" while it silently
// consumes nothing (H6). On reconnect we therefore rebuild every consumer the
// registry knows about from its recorded group / topic / handler.
//
// Idempotent: any live consumer for a registered group+topic is torn down and
// replaced (never stacked), so a message is never delivered twice. Consumers
// NOT in the registry (e.g. RPC-client reply consumers, which are
// request-scoped and owned by their client) are left untouched.
export const reRegisterKafkaConsumers = async (
  state: KafkaSharedState,
  logger: ILogger,
): Promise<void> => {
  if (!state.kafka) return;

  const registrations = [...state.consumerRegistrations];
  if (registrations.length === 0) return;

  // ── Tear down stale consumers the registry owns ──
  const pooledGroupIds = new Set(
    registrations.filter((reg) => reg.pooled).map((reg) => reg.groupId),
  );

  for (const groupId of pooledGroupIds) {
    const pooled = state.consumerPool.get(groupId);
    if (!pooled) continue;

    state.consumerPool.delete(groupId);
    try {
      pooled.localAbort.abort();
    } catch {
      // Already aborted
    }

    const idx = state.consumers.findIndex((c) => c.consumer === pooled.consumer);
    if (idx !== -1) state.consumers.splice(idx, 1);

    await stopConsumerWithTimeout(pooled.consumer);
  }

  for (const reg of registrations) {
    if (reg.pooled) continue;
    await stopKafkaConsumer(state, reg.consumerTag);
  }

  // ── Rebuild every registration ──
  for (const reg of registrations) {
    try {
      if (reg.pooled) {
        // The pool dedups by groupId+topic: a second registration sharing a
        // group appends its callback to the existing consumer rather than
        // opening a duplicate one — restoring the original competing-consumer
        // fan-out without stacking consumers.
        await getOrCreatePooledConsumer({
          state,
          groupId: reg.groupId,
          topic: reg.topic,
          onMessage: reg.onMessage,
          logger,
          fromBeginning: reg.fromBeginning ?? false,
        });
      } else {
        const handle = await createKafkaConsumer({
          kafka: state.kafka,
          groupId: reg.groupId,
          topic: reg.topic,
          onMessage: reg.onMessage,
          sessionTimeoutMs: state.sessionTimeoutMs,
          logger,
          fromBeginning: reg.fromBeginning ?? false,
          abortSignal: state.abortController.signal,
          // Reuse the tag so the owning instance's cached consumerTag (e.g. the
          // stream pipeline's) still matches the rebuilt consumer.
          consumerTag: reg.consumerTag,
        });
        state.consumers.push(handle);
      }
    } catch (error) {
      logger.error("Failed to re-register kafka consumer after reconnect", {
        groupId: reg.groupId,
        topic: reg.topic,
        pooled: reg.pooled,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
