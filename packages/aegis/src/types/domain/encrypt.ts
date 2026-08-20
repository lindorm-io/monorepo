import type { Dict } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { DomainClaims } from "../claims/domain/domain-claims.js";
import type { AegisDecryptKey, AegisEncKey } from "../keys/key-selectors.js";
import type { DomainTokenEnvelope } from "./domain-envelope.js";

/**
 * The `aegis.encrypt` input — the mirror of `sign`'s payload, and SEALED
 * AS GIVEN. The value returned by `aegis.decrypt` is the value handed to
 * `encrypt` (the `@lindorm/aes` contract, on a token wire): a `Dict` round-trips
 * as a `Dict` under its OWN literal keys — serialised as `application/json`, so
 * `{ subject: "x" }` stays `subject` and never becomes `sub`/label 2 — and a
 * `Buffer`/`string` comes back as those bytes / that string.
 *
 * NOTHING here is translated. Domain↔wire claim translation belongs to
 * `mint`/`verify`/`parse`, which have a claims layer and an author to attribute
 * the claims to; encryption establishes confidentiality and says nothing about
 * authorship, so renaming a recovered key into a registered vocabulary would
 * assert on the caller's behalf something only a signature can carry.
 */
export type EncryptData = (DomainClaims & Dict) | Buffer | string;

/**
 * The `aegis.encrypt` options — the mirror of the `sign` option family,
 * scoped to the encryption surface. `aes` is a separate surface (`aegis.aes`),
 * so `format` is only `jwe`/`cwe`. Encryption is pure confidentiality: there is
 * NO inner signature (sender auth ⇒ `mint(profile, content, { encrypt })`).
 */
export type EncryptOptions = DomainTokenEnvelope<AegisEncKey> & {
  /** Wire encoding — a JWE (default) or a COSE_Encrypt0 (`cwe`). */
  format?: "jwe" | "cwe";
  /** The domain token type stamped on the wire header (`typ`). */
  type?: TokenType;
  /**
   * ECDH-ES Agreement PartyUInfo (RFC 7518 §4.6.1.2) — the base64url producer
   * identity. Consumed by the Concat-KDF AND emitted on the protected header
   * (`apu`) ONLY when the recipient key is an ECDH-ES algorithm; supplied for any
   * other algorithm (including the `cwe` path) it is stripped (not fed to the KDF,
   * not emitted).
   */
  partyProducer?: string;
  /**
   * ECDH-ES Agreement PartyVInfo (RFC 7518 §4.6.1.3) — the base64url recipient
   * identity. Same ECDH-ES gate/strip semantics as {@link partyProducer}; on the
   * read side a decrypt configured with `partyRecipient` verifies the incoming
   * `apv` matches it.
   */
  partyRecipient?: string;
  /**
   * Allow a lindorm-proprietary (private-use) COSE content encryption on the
   * `cwe` path (default `false`); threaded to `CweKit.encrypt`.
   * A no-op on the `jwe` path.
   *
   * ⚠ ON THIS VERB IT IS THE ENCRYPTION-REGISTRATION GATE AND NOTHING ELSE: this
   * verb seals the caller's value verbatim, so there are no claims to label and
   * the flag cannot move a single plaintext byte. It makes
   * `assertCoseRegistered` refuse a content encryption RFC 9053 §4 does not
   * register (the AES-CBC-HMAC family), so a caller must state that it accepts an
   * on-platform-only artifact before one is produced.
   *
   * ⛔ INPUT-ONLY — there is no read-side twin. `decrypt`, `verify` and `parse`
   * take no such flag (`decodeCwtClaims` normalises integer labels and string
   * keys unconditionally), so a proprietary artifact is read back with nothing
   * declared. Do not give it a claim-label behaviour here; there are no claims on
   * this path to label.
   */
  proprietary?: boolean;
};

/**
 * The `aegis.decrypt` options. Confidentiality-only: it reuses the
 * deployment `decrypt` key policy plus this per-call CHECK/injection.
 */
export type DecryptOptions = {
  /**
   * Custom header parameters the CALLER takes responsibility for — it will act on
   * them after aegis returns. RFC 7515 §4.1.11 puts the duty on the RECIPIENT, and
   * aegis is never the final recipient; it verifies on the application's behalf.
   *
   * A `crit` member is accepted only when it is named here AND carried by the
   * token. Absent means nothing is declared, so EVERY critical parameter is
   * refused — `objectId` included, since registering a parameter says nothing
   * about whether the application can act on it. Fail closed.
   *
   * ⚠ DOMAIN names, like every other domain surface — `["objectId"]`, never
   * `["oid"]`, which is refused. An unregistered custom parameter is spelled
   * identically at both tiers.
   */
  critical?: Array<string>;
  /** Per-call decryption key policy — a CHECK (plus injectable `kryptos`). */
  key?: AegisDecryptKey;
};
