import type { Wire } from "./raw-bucket.js";

/** The claims format a domain sign or mint writes on each wire. */
export const SIGNED_FORMAT = { jose: "jwt", cose: "cwt" } as const satisfies Record<
  Wire,
  string
>;

/** The sealed format `encrypt` writes on each wire. */
export const SEALED_FORMAT = { jose: "jwe", cose: "cwe" } as const satisfies Record<
  Wire,
  string
>;

/** The opaque signed format the raw kit namespaces write on each wire. */
export const OPAQUE_FORMAT = { jose: "jws", cose: "cws" } as const satisfies Record<
  Wire,
  string
>;
