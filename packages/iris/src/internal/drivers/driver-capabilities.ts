import type { IrisCapabilities, IrisDriverType } from "../../types/index.js";
import { KAFKA_CAPABILITIES } from "./kafka/kafka-capabilities.js";
import { MEMORY_CAPABILITIES } from "./memory/memory-capabilities.js";
import { NATS_CAPABILITIES } from "./nats/nats-capabilities.js";
import { RABBIT_CAPABILITIES } from "./rabbit/rabbit-capabilities.js";
import { REDIS_CAPABILITIES } from "./redis/redis-capabilities.js";

/**
 * Per-driver capability registry. Each entry is the SAME constant the driver
 * instance exposes as `driver.capabilities`, so the source can answer
 * `source.capabilities` even before it has connected (and thus instantiated a
 * driver) — a purely type-level import, no broker library is pulled in.
 */
const CAPABILITIES: Record<IrisDriverType, IrisCapabilities> = {
  memory: MEMORY_CAPABILITIES,
  rabbit: RABBIT_CAPABILITIES,
  kafka: KAFKA_CAPABILITIES,
  nats: NATS_CAPABILITIES,
  redis: REDIS_CAPABILITIES,
};

export const driverCapabilities = (driver: IrisDriverType): IrisCapabilities =>
  CAPABILITIES[driver];
