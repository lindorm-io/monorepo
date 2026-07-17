import { resolveConsumerName } from "../../../utils/resolve-consumer-name.js";
import type { QueueNameOptions } from "../types/rabbit-types.js";
import { sanitizeRoutingKey } from "./sanitize-routing-key.js";

export type { QueueNameOptions };

export const resolveQueueName = ({
  exchange,
  topic,
  queue,
  type,
}: QueueNameOptions): string => {
  if (type === "delay") {
    return `${exchange}.delay.${sanitizeRoutingKey(topic)}`;
  }

  return `${exchange}.${resolveConsumerName({ type, topic: sanitizeRoutingKey(topic), queue })}`;
};
