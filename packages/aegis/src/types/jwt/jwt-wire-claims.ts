import type { JwtClaims } from "../claims/jwt/jwt-claims.js";

/**
 * The OPEN, wire-typed JWT claim set — jose `JWTPayload` parity (R13).
 *
 * It is the registry-aligned `JwtClaims` intersection (every REGISTERED claim
 * hard-typed to its WIRE form — `exp`/`nbf`/`iat` as `number` NumericDate,
 * `aud` as `Array<string>`, `iss`/`sub`/`jti` as `string`, the `*_verified`
 * flags as `boolean`, …) OPENED with an index signature so any UNREGISTERED
 * custom claim is permitted as `unknown` (dealer's choice).
 *
 * So `{ exp: 123 }` type-checks, `{ exp: "soon" }` is a type error, and
 * `{ whatever: … }` is allowed. Because the kit is wire-level, `exp` is a
 * `number` here; the `Date` form appears only at the Aegis domain layer
 * (`VerifiedToken.claims.expiresAt: Date`).
 *
 * A drift guard (`jwt-wire-claims.test.ts`) binds the registered members of
 * `JwtClaims` to `CLAIM_REGISTRY`: their names must equal the `category:"claims"`
 * jose names and each TS type must match its `ClaimValueKind` wire form.
 */
export type JwtWireClaims = JwtClaims & { [claim: string]: unknown };
