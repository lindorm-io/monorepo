import type { ConsumerNameOptions } from "../types/nats-types.js";

export type { ConsumerNameOptions };

export const resolveConsumerName = (options: ConsumerNameOptions): string => {
  const { prefix, topic, queue, type } = options;
  const parts = [prefix, type];

  switch (type) {
    case "subscribe":
      parts.push(queue ? `${topic}.${queue}` : topic);
      break;
    case "worker":
      parts.push(queue ?? topic);
      break;
    case "rpc":
      parts.push(queue ?? topic);
      break;
  }

  return parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
};
