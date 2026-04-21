import type { ILogger } from "@lindorm/logger";
import type { KafkaClient, KafkaSharedState } from "../types/kafka-types.js";

export const ensureKafkaTopic = async (
  kafka: KafkaClient,
  topic: string,
  createdTopics: Set<string>,
  logger: ILogger,
): Promise<void> => {
  if (createdTopics.has(topic)) return;

  const admin = kafka.admin();

  try {
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic }],
      waitForLeaders: true,
    });
    createdTopics.add(topic);
    logger.debug("Auto-created topic", { topic });
  } catch {
    // Topic may already exist — that's fine
    createdTopics.add(topic);
  } finally {
    await admin.disconnect();
  }
};

export const ensureKafkaTopicFromState = async (
  state: KafkaSharedState,
  topic: string,
  logger: ILogger,
): Promise<void> => {
  if (!state.kafka) {
    throw new Error("Cannot ensure topic: Kafka client is not connected");
  }
  await ensureKafkaTopic(state.kafka, topic, state.createdTopics, logger);
};
