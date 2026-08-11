import { AesKit, type IAesKit } from "@lindorm/aes";
import { KryptosKit } from "@lindorm/kryptos";

/**
 * The HKDF derivation path for the session-record key, and its DOMAIN SEPARATOR:
 * the same `sec` bytes derive a different key under a different path, so a secret
 * lifted from one artifact cannot open another. Bumping the version rotates every
 * record key — which invalidates every live session cookie, so it is a deliberate,
 * breaking act.
 *
 * ⚠ The path is MANDATORY, not decorative. `KryptosKit.from.derive` derives the kid
 * from the HKDF tail only when a path is set and assigns a RANDOM one when it is
 * not (`kryptos/internal/utils/from/der-from-derive.ts`), so an absent path would
 * make every re-derivation of the same secret produce a different kid.
 */
export const SESSION_RECORD_KEY_PATH = "urn:lindorm:pylon:session-record:v1";

/**
 * The content-encryption kit for `Session.payloadEncrypted`, derived from the `sec`
 * the HOLDER carries in its session cookie. Pylon stores no copy of that secret, so
 * pylon alone cannot open a stored session: a kv dump is ciphertext and nothing else,
 * and the decrypt IS the authentication — no digest is stored and none is compared,
 * a wrong `sec` derives a wrong key and the AES-GCM tag fails.
 *
 * Returns the KIT, not the kryptos. The `encryption` is half of the key contract and
 * a write/read mismatch on it (`A256GCM` one side, `A256CBC-HS512` the other) would
 * be a silent decrypt failure on every session. Handing back a constructed `AesKit`
 * makes that mismatch unrepresentable — there is one place the pair is stated.
 *
 * `from.derive`, never `from.utf`: `from.utf` validates an oct secret to EXACTLY the
 * algorithm's key size (32 bytes for A256GCM) and `sec` is 86 base64url characters.
 * Derive runs HKDF-SHA256 over the secret and yields a correctly sized CEK from any
 * input length.
 *
 * ⚠ `options.aad` is deliberately NOT used to bind the ciphertext to its row id. In
 * the default `cbor` string mode `AesKit.encrypt` never applies a caller `aad`
 * (`encryptCbor` takes no such parameter) and `AesKit.decrypt` prefers the
 * header-derived `parsed.aad`, so a caller-supplied `aad` is a SILENT no-op in both
 * directions — passing one would look like a binding and be none. The binding is
 * enforced explicitly instead, by the store asserting the sealed payload's `id`
 * equals the row's.
 */
export const sessionRecordKit = (secret: string): IAesKit =>
  new AesKit({
    kryptos: KryptosKit.from.derive({
      algorithm: "dir",
      encryption: "A256GCM",
      deriveFrom: secret,
      path: SESSION_RECORD_KEY_PATH,
      type: "oct",
      use: "enc",
    }),
  });
