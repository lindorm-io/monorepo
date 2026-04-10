import { B64 } from "@lindorm/b64";
import { randomBytes } from "crypto";
import { B64U } from "../constants/format";

/**
 * Generate an opaque token identifier suitable for use as the JWT `jti`
 * claim (RFC 7519 §4.1.7) or any other unique token identifier slot in
 * aegis.
 *
 * Implementation: 20 bytes of CSPRNG output, base64url-encoded without
 * padding. This gives 160 bits of entropy in 27 characters — strictly
 * more entropy than a UUID v4 (which has 122 random bits in 36 chars due
 * to the version/variant overhead) and ~25% shorter on the wire.
 *
 * Consistent across every kit in aegis (JOSE and COSE).
 */
export const generateTokenId = (): string => B64.encode(randomBytes(20), B64U);
