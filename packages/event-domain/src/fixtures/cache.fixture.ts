import { CacheIdentifier, CacheOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_CACHE_IDENTIFIER: CacheIdentifier = {
  id: randomUUID(),
  name: "cacheName",
  context: "cacheContext",
};

export const TEST_CACHE_OPTIONS: CacheOptions = {
  ...TEST_CACHE_IDENTIFIER,
};
