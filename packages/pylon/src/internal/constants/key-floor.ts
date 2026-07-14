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
 */
export const COOKIE_SIGN_FLOOR: AmphoraPredicate = { use: "sig", hasPrivateKey: true };

export const COOKIE_VERIFY_FLOOR: AmphoraPredicate = { use: "sig" };
