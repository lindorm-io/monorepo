import type { ILogger } from "@lindorm/logger";
import type { KafkaSharedState } from "../types/kafka-types.js";

/**
 * Best-effort delete of a topic this client created — an RPC reply topic.
 *
 * Every Kafka RPC client mints a unique reply topic; without this, short-lived
 * clients accumulate orphan reply topics on the broker forever (redis tears its
 * reply stream down on close, kafka did not). The whole operation is wrapped so
 * a delete failure — broker down, topic already gone, deletion disabled on the
 * cluster — never throws out of `close()`.
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
    logger.debug("Deleted RPC reply topic", { topic });
  } catch (error) {
    logger.debug("Failed to delete RPC reply topic (ignored)", {
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
