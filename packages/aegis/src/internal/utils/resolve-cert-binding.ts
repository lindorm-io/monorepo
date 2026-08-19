import type { IKryptos } from "@lindorm/kryptos";
import { AegisKeyError } from "../../errors/index.js";
import type { BindCertificateMode, CertificateHeaderFields } from "../../types/index.js";

export const resolveCertBinding = (
  kryptos: IKryptos,
  mode: BindCertificateMode | undefined,
  thumbprintSha1: boolean,
): CertificateHeaderFields | undefined => {
  const resolved: BindCertificateMode =
    mode === "none"
      ? "none"
      : mode === undefined
        ? kryptos.hasCertificate
          ? "thumbprint"
          : "none"
        : mode;

  if (resolved === "none") return undefined;

  if (!kryptos.hasCertificate) {
    throw new AegisKeyError("bindCertificate requires kryptos with certificateChain", {
      code: "cert_binding_chain_required",
      debug: { kryptosId: kryptos.id, mode },
      title: "Cert Binding Chain Required",
      details:
        "Certificate binding was requested, but the signing kryptos has no certificateChain to derive an x5t#S256 thumbprint from.",
    });
  }

  // ONE derivation, for every field below. It is non-null here — `hasCertificate`
  // above and this accessor answer off the same chain.
  const certificate = kryptos.certificate("b64");

  const fields: CertificateHeaderFields = {
    certificateThumbprint: certificate?.thumbprint,
  };

  // Whether the legacy SHA-1 thumbprint (`x5t`) rides beside the SHA-256 one is
  // the WIRE's answer, not the caller's — it is NOT a `BindCertificateMode` and
  // there is no option that turns it off. Each writer states its wire's constant:
  // `internal/utils/jose-thumbprint-sha1.ts` (`true` — RFC 7515 §4.1.7 gives JOSE
  // a parameter of its own) and `internal/cose/cose-thumbprint-sha1.ts` (`false` —
  // RFC 9360 §2 gives COSE one thumbprint parameter, so the derived SHA-1 digest
  // would have no label to travel under).
  if (thumbprintSha1 === true) {
    fields.certificateThumbprintSha1 = certificate?.thumbprintSha1;
  }

  if (resolved === "chain") {
    // `certificate("b64")` answers `null` rather than an empty chain, so a chain
    // that reaches here has members.
    fields.certificateChain = certificate?.chain;
  }

  return fields;
};
