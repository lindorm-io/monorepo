// Per-group retry topic (M1 targeted retry).
//
// Kafka fan-out is N consumer groups on one topic, so re-publishing a failed
// message to the shared topic redelivers it to EVERY group — every already-
// succeeded subscriber sees a spurious duplicate. Instead each group gets its
// own retry topic that ONLY that group consumes, so a redelivery reaches only
// the group that failed. `groupId` already uniquely identifies the subscriber,
// so it is the natural discriminator.
//
// `baseKafkaTopic` is the already-prefixed kafka topic the group consumes (the
// main topic, or the `.broadcast` topic for a broadcast consumer).
export const resolveRetryTopicName = (baseKafkaTopic: string, groupId: string): string =>
  `${baseKafkaTopic}.retry.${groupId}`;
