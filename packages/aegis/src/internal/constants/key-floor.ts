import type { AmphoraPredicate } from "@lindorm/amphora";

/**
 * The FLOOR of each key operation: the minimum that makes the operation
 * POSSIBLE — nothing else. A floor is POLICY, enforced on every key that
 * reaches the crypto layer, however it got there (selected from the vault,
 * named by a token's `kid`, or injected outright). It is deliberately NOT a
 * mirror image across the four operations, and it deliberately carries no
 * `purpose`, no `operations`, no `publish` and no `internal` — those are all
 * consumer policy, expressible in the consumer's own selector.
 *
 * These mirror amphora's `canSign` / `canVerify` / `canEncrypt` / `canDecrypt`.
 *
 * - `hasPublicKey` is NOT the encrypt floor. An oct key has no public half (its
 *   secret lives in the private slot), so requiring one would exclude every
 *   `dir` / `A*KW` / PBES2 key and break symmetric encryption outright. An
 *   external recipient (a client's JWKS key) is the normal case here, so
 *   `internal` is meaningless too.
 *
 * - `hasPrivateKey` on the DECRYPT floor is what separates the two encryption
 *   directions. `ECDH-ES` derives with the recipient's public key on one side
 *   and its private key on the other, so a key's declared operations report
 *   `deriveKey` for BOTH halves and can never tell encrypt from decrypt — the
 *   key's halves can.
 *
 * - `internal` is on NEITHER floor. `hasPrivateKey` already excludes every
 *   remotely-fetched key (a JWKS only ever yields public halves), so it buys
 *   nothing on top — while it WOULD block the one legitimate non-internal
 *   decrypt case: an RFC 9101 encrypted request object, whose `A128KW` / `dir`
 *   key is derived from the client secret and is emphatically not our own.
 */
/**
 * The TIME half of the floor, and it is not symmetric either.
 *
 * A key's lifetime runs pending → active → expired. The vault already drops
 * inactive keys from a QUERY — but `findById` is unfiltered by design, and an
 * INJECTED `kryptos` never touches the vault at all. So without the clock in the
 * floor, an expired or not-yet-valid key handed in by a caller would sign.
 *
 * - WRITE (`sign` / `encrypt`) demands `isActive`: the key must be usable NOW.
 * - READ (`verify` / `decrypt`) demands only `isPending: false`. An EXPIRED key
 *   MUST still verify what it signed while it was valid — that is the whole
 *   point of `findById` being unfiltered, and of keys having an `expiresAt`
 *   rather than vanishing. But a key whose `notBefore` has not yet passed cannot
 *   have signed or sealed anything, ever, so nothing it names is trustworthy.
 */
export const SIGN_FLOOR: AmphoraPredicate = {
  use: "sig",
  hasPrivateKey: true,
  isActive: true,
};

export const VERIFY_FLOOR: AmphoraPredicate = { use: "sig", isPending: false };

export const ENCRYPT_FLOOR: AmphoraPredicate = { use: "enc", isActive: true };

export const DECRYPT_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isPending: false,
};
