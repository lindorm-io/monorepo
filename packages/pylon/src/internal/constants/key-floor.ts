import type { AmphoraPredicate } from "@lindorm/amphora";

/**
 * The FLOOR of each key operation PYLON performs itself: the minimum that makes
 * the operation POSSIBLE — nothing else. A floor is POLICY, enforced on every
 * key that reaches the crypto layer, however it got there (selected from the
 * vault, named by a cookie's `.kid`, or injected outright). It deliberately
 * carries no `purpose`, no `publish` and no `internal` — those are the
 * deployment's policy, expressible in its own selector (`PylonKeys`).
 *
 * These mirror aegis's `SIGN_FLOOR` / `VERIFY_FLOOR`, and exist here for the
 * same reason: pylon owns a floor exactly where pylon does the lookup. Cookie
 * and session ENCRYPTION resolve through `aegis.aes`, which owns those floors —
 * pylon hands it a selector and adds nothing.
 *
 * - `hasPrivateKey` — not `operations: ["sign"]` — is the question that matters
 *   on the sign side: it asks what the key MATERIAL can do rather than what it
 *   declares to.
 *
 * - The verify floor has no `hasPrivateKey`: a cookie signed with an asymmetric
 *   key must still verify against the public half alone.
 *
 * The TIME half is not a mirror image either, and that asymmetry is the point.
 */

/**
 * WRITE. The key must be usable NOW — `isActive`.
 *
 * Amphora already drops inactive keys from a vault QUERY, so the clock bites
 * where the vault does not: `keys.cookie.signature` may hand pylon a `kryptos`
 * outright (an env-imported cookie secret that never reaches the vault), and
 * that key is never time-checked by anything else. Without the clock here, an
 * expired or not-yet-valid key would sign live cookies.
 */
export const COOKIE_SIGN_FLOOR: AmphoraPredicate = {
  use: "sig",
  hasPrivateKey: true,
  isActive: true,
};

/**
 * READ. The key must have been usable at SOME point — `isPending: false` — and
 * that is ALL. Deliberately NOT `isActive`.
 *
 * `findByIdSync` is unfiltered by design so that a cookie signed by a key that
 * has since rotated out still verifies; an EXPIRED key MUST therefore keep
 * verifying, or every rotation would log out every live session. That is the
 * whole reason a key carries an `expiresAt` rather than vanishing.
 *
 * But the `.kid` is the CLIENT's claim — it picks which key in the vault answers
 * for its cookie — and a key whose `notBefore` has not passed cannot have signed
 * anything, ever. Nothing it names is real, so `isPending` is refused.
 */
export const COOKIE_VERIFY_FLOOR: AmphoraPredicate = { use: "sig", isPending: false };
