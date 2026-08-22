import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { ParsedToken } from "../../types/index.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import { buildTokenResult } from "./build-token-result.js";
import { detectTokenFormat } from "./detect-token-format.js";
import { TOKEN_FORMAT_KIND } from "./token-format-kind.js";

/**
 * THE keyless domain CLAIMS parse (`aegis.parse`) — one implementation for both
 * wires. Decode and domain-translate a STRUCTURED token WITHOUT a key and WITHOUT
 * a signature check.
 *
 * `parse` is fundamentally a claims reader, so it handles ONLY the three
 * claims-bearing formats:
 *
 * - STRUCTURED (jwt / cwt / cwm): the domain header + the claims buckets.
 * - UNSTRUCTURED (jws / cws): REFUSED — an opaque signed token carries no claims
 *   layer. Read it with `aegis.jws.verify` / `aegis.cws.verify`.
 * - ENCRYPTED (jwe / cwe): REFUSED — the content is ciphertext, unreadable
 *   without the key. Use `aegis.decrypt`, or `aegis.verify` for a
 *   sign-then-encrypt token.
 *
 * A structured result is UNVERIFIED: nothing here proves authenticity.
 */
export const parseToken = <C extends Dict = Dict>(token: string): ParsedToken<C> => {
  const format = detectTokenFormat(token);

  if (format === undefined) {
    throw new AegisError("Invalid token type", {
      code: "unsupported_token_type",
      debug: { token: sanitiseToken(token) },
      title: "Unsupported Token Type",
      details:
        "The token is not a recognised JOSE (JWT/JWS/JWE) or COSE (CWT/CWM/CWS/CWE) token, so Aegis cannot parse it.",
    });
  }

  if (TOKEN_FORMAT_KIND[format] === "encrypted") {
    throw new AegisDomainError("Cannot parse an encrypted token", {
      code: "parse_requires_decrypt",
      data: { format },
      debug: { token: sanitiseToken(token) },
      title: "Parse Requires Decrypt",
      details:
        "aegis.parse is keyless and unverified, so it cannot read a JWE/CWE — its claims are encrypted. Use aegis.decrypt to read confidential claims, or aegis.verify for a sign-then-encrypt token.",
    });
  }

  if (TOKEN_FORMAT_KIND[format] === "opaque") {
    throw new AegisDomainError("Cannot parse an opaque token", {
      code: "parse_requires_claims",
      data: { format },
      debug: { token: sanitiseToken(token) },
      title: "Parse Requires Claims",
      details:
        "An opaque JWS/CWS is a signed blob with no claims layer, so aegis.parse (a claims reader) has nothing to return. Read it with aegis.jws.verify / aegis.cws.verify.",
    });
  }

  const wire = tokenWireFor(format);
  const read = wire.decodeClaims(token);

  // `wire` is dropped: `ParsedToken` declares no wire pass-through, because an
  // UNVERIFIED read has no authenticated payload to pass through.
  const { wire: _wire, ...result } = buildTokenResult<C>({
    format: read.format,
    wire: read.wire,
    protectedHeader: read.protectedHeader,
    unprotectedHeader: read.unprotectedHeader,
    token,
    // A parseable token is not encrypted, so sensitive claims stay suppressed
    // (the aegis confidentiality gate) and no `dpop` — a verify-only field — is ever populated.
    encrypted: false,
    nameOf: wire.nameOf,
    issuerPresence: wire.issuerPresence,
  });

  return result as unknown as ParsedToken<C>;
};
