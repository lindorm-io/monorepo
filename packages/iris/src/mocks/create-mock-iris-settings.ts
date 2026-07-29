import type { IrisCapabilities } from "../types/index.js";
import type { IrisSourceOptionsBase } from "../types/source-options.js";

/**
 * Construction settings for the memory-backed iris mocks. Picks the real
 * `IrisSource` option fields that shape an in-memory mock — the rest (driver,
 * amphora, encryption, persistence, …) are fixed or irrelevant here.
 *
 * `messages` accepts the same input as the real source (decorated `@Message`
 * classes or glob directories); `logger` defaults to the framework mock logger.
 *
 * `capabilities` is an override seam: the mock source advertises the real
 * `MEMORY_CAPABILITIES` by default, and any field named here overrides it — so a
 * test can flip `priority` on, or `rpc` off, without swapping the whole driver.
 */
export type CreateMockIrisSettings = Partial<
  Pick<IrisSourceOptionsBase, "messages" | "logger">
> & { capabilities?: Partial<IrisCapabilities> };
