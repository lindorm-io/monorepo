import type { GroupNameOptions } from "../types/redis-types";

export type { GroupNameOptions };

export const resolveGroupName = (options: GroupNameOptions): string => {
  const { prefix, topic, queue, type } = options;

  switch (type) {
    case "subscribe":
      return queue ? `${prefix}.${topic}.${queue}` : `${prefix}.sub.${topic}`;
    case "worker":
      return `${prefix}.wq.${queue ?? topic}`;
    case "rpc":
      return `${prefix}.rpc.${queue ?? topic}`;
  }
};
