/**
 * OIDC Core §5.6 claim types. A CLOSED set — the spec defines exactly these
 * three.
 */
export const ClaimType = {
  /** wire: `normal` — claims asserted directly by the OP */
  Normal: "normal",
  /** wire: `aggregated` — claims asserted by a third party, delivered in a bundled JWT */
  Aggregated: "aggregated",
  /** wire: `distributed` — claims asserted by a third party, fetched by the client */
  Distributed: "distributed",
} as const;

export type ClaimType = (typeof ClaimType)[keyof typeof ClaimType];
