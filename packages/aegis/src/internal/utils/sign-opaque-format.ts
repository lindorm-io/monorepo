import type { TokenFormat, TokenFormatTag } from "../../types/index.js";

/**
 * Which OPAQUE signed format `aegis.sign` emits for each write format it accepts
 * — and therefore, through `tokenWireFor`, which wire signs it.
 *
 * ⚠ PRESERVED, not designed: only `cws` has ever reached the COSE signer. Every
 * other value — `cwt` and `cwm` included — signs a JWS today, because the verb
 * asked `format === "cws"` and let everything else fall out of the tail. Letting
 * a claims-bearing COSE format select the COSE wire here would be a NEW
 * capability, tracked separately, so the fall-through is written down as a TOTAL
 * record instead: a new write format is a compile error at the one place the
 * fact belongs, rather than a silent JWS.
 */
export const SIGN_OPAQUE_FORMAT: Record<TokenFormat, TokenFormatTag> = {
  jwt: "jws",
  jws: "jws",
  cwt: "jws",
  cwm: "jws",
  cws: "cws",
};
