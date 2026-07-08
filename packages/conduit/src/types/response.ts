import type { Dict, Header } from "@lindorm/types";

export type ConduitResponse<D = any> = {
  /**
   * Whether the response was served from a cache, inferred from its headers.
   * `"client"` = conduit's own cache middleware; `"upstream"` = a cache further
   * out (pylon `useCache`, a CDN/proxy, or a positive `Age`); `null` = not cached.
   */
  cached: "upstream" | "client" | null;
  data: D;
  status: number;
  statusText: string;
  headers: Dict<Header>;
};
