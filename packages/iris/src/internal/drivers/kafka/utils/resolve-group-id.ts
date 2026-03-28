import type { GroupIdOptions } from "../types/kafka-types";

export type { GroupIdOptions };

export const resolveGroupId = (options: GroupIdOptions): string => {
  const { prefix, topic, queue, type, generation } = options;
  const gen = generation ? `.g${generation}` : "";

  switch (type) {
    case "subscribe":
      return queue ? `${prefix}.${topic}.${queue}${gen}` : `${prefix}.sub.${topic}${gen}`;
    case "worker":
      return `${prefix}.wq.${queue ?? topic}${gen}`;
    case "rpc":
      return `${prefix}.rpc.${queue ?? topic}${gen}`;
  }
};
