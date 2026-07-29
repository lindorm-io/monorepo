import type { ProteusSourceOptionsBase } from "../types/source-options.js";

/**
 * Construction settings for the memory-backed proteus mocks. Picks the three
 * real `ProteusSource` option fields that shape an in-memory mock — the rest
 * (driver, breaker, cache, encryption, …) are fixed or irrelevant here.
 *
 * `entities` accepts the same input as the real source (decorated classes or
 * glob directories); `logger` defaults to the framework mock logger; `namespace`
 * sets the schema/prefix.
 */
export type CreateMockProteusSettings = Partial<
  Pick<ProteusSourceOptionsBase, "entities" | "logger" | "namespace">
>;
