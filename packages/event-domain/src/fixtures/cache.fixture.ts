import { CacheIdentifier, CacheOptions } from "../types";
import { randomUUID } from "crypto";

export const TEST_CACHE_IDENTIFIER: CacheIdentifier = {
  id: randomUUID(),
  name: "cache_name",
  context: "default",
};

export const TEST_CACHE_OPTIONS: CacheOptions = {
  ...TEST_CACHE_IDENTIFIER,
};
