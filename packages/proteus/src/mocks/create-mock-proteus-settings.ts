import type { ProteusSourceSettingsBase } from "../types/source-options.js";

/**
 * Construction settings for the memory-backed proteus mocks — every real
 * `ProteusSource` option except `driver` (fixed to `"memory"`) and `breaker`
 * (the memory driver has no network I/O, so it is disabled regardless).
 *
 * `entities` accepts the same input as the real source (decorated classes or
 * glob directories); `logger` defaults to the framework mock logger; `namespace`
 * sets the schema/prefix; `naming` transforms column names; `cache` and `meta`
 * pass straight through.
 *
 * `amphora` + `encryption` drive `@Encrypted` fields. Omit BOTH and the mock
 * provisions a real vault with a minted KEK, so an encrypted entity round-trips
 * untouched (see `createMockProteusVault`). Pass your own `amphora` and the key
 * policy is yours verbatim — including the source-load failure when a bare
 * `@Encrypted()` field names no key.
 */
export type CreateMockProteusSettings = Partial<
  Pick<
    ProteusSourceSettingsBase,
    | "amphora"
    | "cache"
    | "encryption"
    | "entities"
    | "logger"
    | "meta"
    | "naming"
    | "namespace"
  >
>;
