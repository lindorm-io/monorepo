import type { Dict } from "@lindorm/types";
import type { TokenType } from "../constants/token-type.js";
import type { OmitMode } from "../internal/utils/apply-omit.js";
import type { DomainClaims } from "../internal/utils/extract-claims.js";
import type { AegisDecryptKey, AegisEncKey } from "./aegis.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "./header.js";

/**
 * The `aegis.encrypt` input (§5e) — the mirror of `sign`'s payload. A plain
 * object is a DOMAIN-keyed claims set (translated to the wire before it is
 * encrypted); a `Buffer`/`string` is OPAQUE and passes through untouched.
 */
export type EncryptData = (DomainClaims & Dict) | Buffer | string;

/**
 * The `aegis.encrypt` options (§5e) — the mirror of the `sign` option family,
 * scoped to the encryption surface. `aes` is a separate surface (`aegis.aes`),
 * so `format` is only `jwe`/`cwe`. Encryption is pure confidentiality: there is
 * NO inner signature (sender auth ⇒ `mint(profile, content, { encrypt })`).
 */
export type EncryptOptions = {
  /** Wire encoding — a JWE (default) or a COSE_Encrypt0 (`cwe`). */
  format?: "jwe" | "cwe";
  /** Per-call recipient key policy; its `encryption` picks the content AEAD. */
  key?: AegisEncKey;
  /** The domain token type stamped on the wire header (`typ`). */
  type?: TokenType;
  /** How empty claims are pruned before encoding; ignored for opaque data. */
  omit?: OmitMode;
  /** Caller-supplyable wire header fields. */
  header?: TokenEncryptOrSignOptions;
  bindCertificate?: BindCertificateMode;
  /**
   * Allow a lindorm-proprietary (private-use) COSE content encryption on the
   * `cwe` path (default `false`, D5 interop gate); threaded to `CweKit.encrypt`.
   * A no-op on the `jwe` path.
   */
  proprietary?: boolean;
};

/**
 * The `aegis.decrypt` options (§5e). Confidentiality-only: it reuses the
 * deployment `decrypt` key policy plus this per-call CHECK/injection.
 */
export type DecryptOptions = {
  /** Per-call decryption key policy — a CHECK (plus injectable `kryptos`). */
  key?: AegisDecryptKey;
};
