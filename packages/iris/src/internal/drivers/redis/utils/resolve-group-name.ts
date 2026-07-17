import { resolveConsumerName } from "../../../utils/resolve-consumer-name.js";
import type { GroupNameOptions } from "../types/redis-types.js";

export type { GroupNameOptions };

export const resolveGroupName = ({
  prefix,
  topic,
  queue,
  type,
}: GroupNameOptions): string =>
  `${prefix}.${resolveConsumerName({ type, topic, queue })}`;
