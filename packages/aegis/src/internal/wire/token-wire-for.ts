import { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import { COSE_TOKEN_WIRE } from "./cose-token-wire.js";
import { JOSE_TOKEN_WIRE } from "./jose-token-wire.js";
import type { TokenWire } from "./token-wire.js";

/**
 * The ONE format → wire lookup. A TOTAL record, so a new token format is a
 * compile error here rather than a silent fall through to whichever wire the
 * ladder happened to end on — which is exactly how three verbs came to disagree
 * about what a typ-less COSE token is.
 */
const WIRE_BY_FORMAT: Record<TokenFormatTag, TokenWire> = {
  jwt: JOSE_TOKEN_WIRE,
  jws: JOSE_TOKEN_WIRE,
  jwe: JOSE_TOKEN_WIRE,
  cwt: COSE_TOKEN_WIRE,
  cwm: COSE_TOKEN_WIRE,
  cws: COSE_TOKEN_WIRE,
  cwe: COSE_TOKEN_WIRE,
};

export const tokenWireFor = (format: TokenFormatTag): TokenWire => {
  const wire = WIRE_BY_FORMAT[format];

  if (wire) return wire;

  throw new AegisError("Unsupported token format", {
    code: "unsupported_token_format",
    data: { format },
    title: "Unsupported Token Format",
    details: "No token wire is registered for this format.",
  });
};
