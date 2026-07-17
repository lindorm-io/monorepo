import type { ILogger } from "@lindorm/logger";
import type { KafkaSharedState } from "../types/kafka-types.js";

/**
 * Best-effort delete of a topic this client created — an RPC reply topic, or a
 * per-group retry topic (M1).
 *
 * Both are unique, client-owned topics that would otherwise accumulate on the
 * broker forever (redis tears its reply stream down on close, kafka did not).
 * The whole operation is wrapped so a delete failure — broker down, topic
 * already gone, deletion disabled on the cluster — never throws out of
 * `close()`/unsubscribe.
 */
export const deleteKafkaTopicFromState = async (
  state: KafkaSharedState,
  topic: string,
  logger: ILogger,
): Promise<void> => {
  if (!state.kafka) return;

  const admin = state.kafka.admin();

  try {
    await admin.connect();
    await admin.deleteTopics({ topics: [topic] });
    state.createdTopics.delete(topic);
    logger.debug("Deleted topic", { topic });
  } catch (error) {
    logger.debug("Failed to delete topic (ignored)", {
      topic,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // Admin may never have connected — nothing to clean up.
    }
  }
};
