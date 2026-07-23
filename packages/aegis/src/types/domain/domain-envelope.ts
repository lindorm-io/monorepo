import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { BindCertificateMode } from "../header/domain-header.js";
import type { WireProtectedHeader } from "../header/wire-envelope.js";

/**
 * The shared DOMAIN sign/encrypt envelope — the domain twin of
 * {@link WireTokenEnvelope}. It factors the cluster every domain write option
 * hand-copied: the caller-controlled PROTECTED wire header bag, the empty-claim
 * prune mode, the cert-binding knobs, and the per-call key policy. `SignJwtOptions`,
 * `EncryptOptions`, and `RawSignInput` each intersect it (adding their own extras);
 * `K` types the per-call key (an {@link AegisSignKey} on the sign paths, an
 * {@link AegisEncKey} on encrypt).
 */
export type DomainTokenEnvelope<K> = {
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true` (older-client compat). Independent of
   * `bindCertificate`; the read side never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  /** Caller-controlled PROTECTED wire header params (`oid` rides here, ruling 3). */
  header?: WireProtectedHeader;
  /**
   * How empty claims are pruned before signing/encoding. `"empty"` (default) drops
   * null/empty-string/empty-array/empty-object recursively; `"undefined"` drops
   * only undefined. Inert for opaque Buffer/string payloads.
   */
  omit?: OmitMode;
  /**
   * Per-call key policy. Ignored by the wire kits (handed an explicit key);
   * consumed by `Aegis`, which resolves one.
   */
  key?: K;
};
