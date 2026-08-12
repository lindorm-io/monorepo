import type { TokenFormatTag } from "./verified-token.js";

/**
 * The wire encoding a WRITE targets — the sign/mint SUBSET of
 * {@link TokenFormatTag}. The encrypted outers (`jwe`/`cwe`) are excluded because
 * they are never a sign target: an encrypted result is reached through a mint's
 * `encrypt` option or `aegis.encrypt`, never by naming the format.
 *
 * Public because it is the type of `ProfileMintOptions.format` and
 * `RawSignInput.format` — both caller-facing. It used to sit unexported beside a
 * one-line identity function that "selected" it, so a consumer annotating a
 * variable it was about to pass had no name to reach for.
 */
export type TokenFormat = Exclude<TokenFormatTag, "jwe" | "cwe">;

/**
 * The formats a PROFILED mint can target — the claims-bearing subset.
 *
 * ⚠ Narrower than {@link TokenFormat} on purpose. A profile is a statement about
 * CLAIMS, so it has nothing to say about an opaque signature: `mint(profile, …,
 * { format: "jws" })` used to silently emit a JWT, and `{ format: "cws" }` used
 * to reach the COSE typ derivation and throw about a media type the caller never
 * wrote — after both keys had been resolved. Neither is expressible now.
 */
export type ClaimsTokenFormat = Extract<TokenFormat, "jwt" | "cwt" | "cwm">;
