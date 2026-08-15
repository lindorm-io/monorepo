import type {
  BindCertificateMode,
  DomainProtectedHeader,
} from "../header/domain-header.js";

/**
 * The shared DOMAIN sign/encrypt envelope — the domain twin of
 * {@link WireTokenEnvelope}. It factors the cluster every domain write option
 * hand-copied: the caller-controlled PROTECTED wire header bag, the cert-binding
 * knobs, and the per-call key policy. `SignTokenOptions`, `EncryptOptions`, and
 * `RawSignInput` each intersect it (adding their own extras); `K` types the
 * per-call key (an {@link AegisSignKey} on the sign paths, an {@link AegisEncKey}
 * on encrypt).
 */
export type DomainTokenEnvelope<K> = {
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true` (older-client compat). Independent of
   * `bindCertificate`; the read side never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  /**
   * Caller-controlled PROTECTED header params, in DOMAIN vocabulary
   * (`objectId`/`contentType`/`critical`/…). Translated to whichever wire the
   * call ends up emitting — so the same option produces a JOSE `oid` and the
   * COSE label the parameter rides under without the caller choosing between
   * them.
   *
   * ⚠ On COSE, which label that is depends on the interop mode: `oid` has no
   * IANA COSE parameter, so it rides a lindorm PRIVATE-USE label, and the
   * interoperable default spells that as the string label `"oid"` rather than
   * the integer no foreign reader can interpret. `proprietary` chooses; nothing
   * is added or dropped either way.
   */
  header?: DomainProtectedHeader;
  /**
   * Per-call key policy. Ignored by the wire kits (handed an explicit key);
   * consumed by `Aegis`, which resolves one.
   */
  key?: K;
};
