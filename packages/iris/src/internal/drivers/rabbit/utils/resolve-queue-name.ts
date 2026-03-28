import type { QueueNameOptions } from "../types/rabbit-types";
import { sanitizeRoutingKey } from "./sanitize-routing-key";

export type { QueueNameOptions };

export const resolveQueueName = (options: QueueNameOptions): string | null => {
  const { exchange, topic, queue, type } = options;

  switch (type) {
    case "subscribe":
      return queue ? `${exchange}.${sanitizeRoutingKey(topic)}.${queue}` : null;
    case "worker":
      return `${exchange}.wq.${queue ?? sanitizeRoutingKey(topic)}`;
    case "rpc":
      return `${exchange}.rpc.${queue ?? sanitizeRoutingKey(topic)}`;
    case "delay":
      return `${exchange}.delay.${sanitizeRoutingKey(topic)}`;
  }
};
