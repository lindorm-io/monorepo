import type { AegisDeps } from "./aegis-deps.js";

/**
 * Whether this write emits the LEGACY SHA-1 certificate thumbprint (`x5t`)
 * beside the SHA-256 one: the per-call request wins, and a call that states
 * nothing falls back to the deployment default a deployment retiring SHA-1 turns
 * off once, on the `Aegis` instance.
 *
 * It serves the TWO sign call sites that resolve a per-call request against the
 * deployment default: `raw-sign-jws.ts` (JwsKit) and `sign-jwt.ts` (JwtKit,
 * reached by BOTH the profiled mint's JOSE wire and the `jwt.sign` namespace).
 * It was four; the JOSE wire and `raw-sign-jwt.ts` collapsed onto `sign-jwt.ts`,
 * and `encrypt-outer.ts` stopped resolving at all — the encrypting outer now
 * hands the CALLER's own value down and `encrypt-jwe.ts` resolves it, which is
 * what makes the per-call value reach `aegis.encrypt` too.
 * It is NOT the only place a SHA-1 default is
 * spelled in this package — `encrypt-jwe.ts` resolves the JweKit ENCRYPT
 * OPTIONS' own field against the resolved deployment value, and
 * `resolve-cert-binding.ts` applies a last-resort `?? true` at the emission
 * site. Those two answer different questions, so they are not call sites this
 * resolver lost.
 */
export const resolveThumbprintSha1 = (
  perCall: boolean | undefined,
  deps: Pick<AegisDeps, "certificateThumbprintSha1">,
): boolean => perCall ?? deps.certificateThumbprintSha1;
