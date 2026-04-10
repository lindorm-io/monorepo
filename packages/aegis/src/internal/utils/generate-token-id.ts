import { B64 } from "@lindorm/b64";
import { randomBytes } from "crypto";
import { B64U } from "../constants/format";

/**
 * @internal — aegis-private helper. MUST NOT be exported from src/index.ts
 * or re-exported through any public barrel. Lives in src/internal/ and is
 * reachable only via the #internal/* subpath imports inside this package.
 *
 * Generate an opaque token identifier suitable for use as the JWT `jti`
 * claim (RFC 7519 §4.1.7) or any other unique token identifier slot in
 * aegis.
 *
 * Implementation: 15 bytes of CSPRNG output, base64url-encoded without
 * padding. This gives 120 bits of entropy in exactly 20 characters.
 *
 * Why 15 bytes:
 * - RFC 7519 §4.1.7 requires only collision resistance for jti ("negligible
 *   probability that the same value will be accidentally assigned"), not
 *   guess resistance. 120 bits gives a birthday bound at ~2^60 tokens,
 *   which is astronomically safe for any realistic issuance rate.
 * - Within 2 bits of UUID v4's 122 random bits, so functionally equivalent
 *   to what Keycloak, ORY Hydra, and most OAuth providers use for jti.
 * - 20 characters is ~26% shorter on the wire than 20-byte variants.
 *
 * Note on scope: `jti` is not an authenticating secret — the token's
 * signature provides authentication, not knowledge of the jti. If you
 * need a high-entropy secret (e.g. refresh token payload material where
 * the bytes themselves authenticate against a stored hash), use a
 * different helper with ≥128 bits per RFC 6749 §10.10.
 */
export const generateTokenId = (): string => B64.encode(randomBytes(15), B64U);
