import type { TokenFormatTag } from "./verified-token.js";

/**
 * The wire encoding a WRITE targets — the sign/mint SUBSET of
 * {@link TokenFormatTag}. The encrypted outers (`jwe`/`cwe`) are excluded because
 * they are never a sign target: an encrypted result is reached through a mint's
 * `encrypt` option or `aegis.encrypt`, never by naming the format.
 *
 * Public because it is the type of `ProfileMintOptions.format` and
 * `RawSignInput.format` — both caller-facing, so a consumer annotating a variable
 * it is about to pass has a name to reach for.
 */
export type TokenFormat = Exclude<TokenFormatTag, "jwe" | "cwe">;

/**
 * The formats a PROFILED mint can target — the claims-bearing subset.
 *
 * ⚠ Narrower than {@link TokenFormat} on purpose. A profile is a statement about
 * CLAIMS, so it has nothing to say about an opaque signature: `mint(profile, …,
 * { format: "jws" })` and `{ format: "cws" }` are compile errors rather than
 * calls that resolve two keys and then emit the wrong wire.
 */
export type ClaimsTokenFormat = Extract<TokenFormat, "jwt" | "cwt" | "cwm">;
