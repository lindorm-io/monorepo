import type { IKryptos } from "@lindorm/kryptos";
import { AegisKeyError } from "../../errors/index.js";
import type { BindCertificateMode, CertificateHeaderFields } from "../../types/index.js";

export const resolveCertBinding = (
  kryptos: IKryptos,
  mode: BindCertificateMode | undefined,
  certificateThumbprintSha1?: boolean,
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

  const fields: CertificateHeaderFields = {
    certificateThumbprint: kryptos.certificateThumbprint ?? undefined,
  };

  // The SHA-1 thumbprint (`x5t`) is an INDEPENDENT emission gate, NOT a
  // `BindCertificateMode` — it rides along whenever a cert is bound and the
  // boolean resolves true (the default). It is a legacy-compat convenience for
  // older clients; the read side NEVER verifies it (only `x5t#S256` binds).
  if (certificateThumbprintSha1 ?? true) {
    fields.certificateThumbprintSha1 = kryptos.certificateThumbprintSha1 ?? undefined;
  }

  if (resolved === "chain") {
    fields.certificateChain =
      kryptos.certificateChain.length > 0 ? kryptos.certificateChain : undefined;
  }

  return fields;
};
