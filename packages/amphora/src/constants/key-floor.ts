import type { AmphoraPredicate } from "../types/index.js";

/**
 * The canonical key-operation FLOORS — the single copy shared across the whole
 * toolkit (aegis, proteus, iris, pylon). A floor is the minimum that makes an
 * operation POSSIBLE — nothing else — enforced on every key that reaches the
 * crypto layer however it got there: selected from the vault, named by a token/
 * ciphertext `kid`, or injected outright as a `kryptos`.
 *
 * A floor carries no `purpose`, no `publish`, no `internal` — those are consumer
 * policy, expressible in the consumer's own selector. The set is NOT a mirror
 * image across operations; the asymmetries below are the whole point.
 *
 * TIME. A key's lifetime runs pending → active → expired. The vault drops
 * inactive keys from a QUERY, but `findById` is unfiltered by design and an
 * INJECTED `kryptos` never touches the vault at all — so the clock must live in
 * the floor:
 *   - WRITE (sign / encrypt) demands `isActive`: the key must be usable NOW.
 *   - READ (verify / decrypt) demands only `isPending: false`. An EXPIRED key
 *     MUST still open what it produced while valid — that is why a key carries an
 *     `expiresAt` rather than vanishing — but a key whose `notBefore` has not
 *     passed can never have produced anything, so nothing it names is real.
 *
 * ENCRYPTION is bimodal, and the mode is the CALLER's knowledge, not the
 * primitive's — so it is NOT expressed by picking `aes` vs `jwe`:
 *   - SEAL_FLOOR is the floor of the encrypt PRIMITIVE (both `aes` and `jwe`).
 *     The minimum to encrypt TO someone is a public key — an RSA/EC recipient
 *     key via ECDH-ES/RSA-OAEP, or a symmetric secret — so it never demands
 *     `hasPrivateKey`. Requiring one would break sealing an id_token (or an aes
 *     blob) to a client's public key, which is a first-class case.
 *   - ENVELOPE_FLOOR is a CONSUMER floor, applied by callers whose operation is
 *     definitionally self-encryption — a proteus column, an iris message, a pylon
 *     cookie — sealed by a key they must reopen themselves. They add
 *     `hasPrivateKey` on top of SEAL. aegis at+jwt does the same by hand (a
 *     per-call predicate), because there the encrypter is also the recipient.
 *   - `hasPublicKey` is never an encrypt floor: an oct key has no public half
 *     (its secret lives in the private slot), so requiring one would exclude
 *     every `dir` / `A*KW` / PBES2 key and break symmetric encryption outright.
 *
 * DECRYPT needs no such split: to OPEN anything you always hold the private/
 * secret half, whether you sealed it to yourself or someone sealed it to you.
 */

export const SIGN_FLOOR: AmphoraPredicate = {
  use: "sig",
  hasPrivateKey: true,
  isActive: true,
};

export const VERIFY_FLOOR: AmphoraPredicate = { use: "sig", isPending: false };

export const SEAL_FLOOR: AmphoraPredicate = { use: "enc", isActive: true };

export const ENVELOPE_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isActive: true,
};

export const DECRYPT_FLOOR: AmphoraPredicate = {
  use: "enc",
  hasPrivateKey: true,
  isPending: false,
};
