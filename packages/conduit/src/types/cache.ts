import type { ConduitResponse } from "./response.js";

export type ConduitCacheKey = {
  method: string;
  url: string;
  query: unknown;
  body: unknown;
};

export type ConduitCacheEntry = {
  response: ConduitResponse;
  /** Epoch milliseconds when the entry was stored (drives the `age` on a hit). */
  storedAt: number;
};
