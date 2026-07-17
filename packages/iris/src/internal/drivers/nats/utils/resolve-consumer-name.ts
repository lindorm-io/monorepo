import { resolveConsumerIdentifier } from "../../../utils/resolve-consumer-name.js";
import type { ConsumerNameOptions } from "../types/nats-types.js";

export type { ConsumerNameOptions };

export const resolveConsumerName = ({
  prefix,
  topic,
  queue,
  type,
}: ConsumerNameOptions): string =>
  [prefix, type, resolveConsumerIdentifier({ type, topic, queue })]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
