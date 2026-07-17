import { resolveConsumerName } from "../../../utils/resolve-consumer-name.js";
import type { GroupIdOptions } from "../types/kafka-types.js";

export type { GroupIdOptions };

export const resolveGroupId = ({
  prefix,
  topic,
  queue,
  type,
  generation,
}: GroupIdOptions): string =>
  `${prefix}.${resolveConsumerName({ type, topic, queue })}${generation ? `.g${generation}` : ""}`;
