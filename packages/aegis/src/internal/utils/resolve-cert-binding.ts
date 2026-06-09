import type { IKryptos } from "@lindorm/kryptos";
import { AegisError } from "../../errors/index.js";
import type { BindCertificateMode, CertificateHeaderFields } from "../../types/index.js";

export const resolveCertBinding = (
  kryptos: IKryptos,
  mode: BindCertificateMode | undefined,
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
    throw new AegisError("bindCertificate requires kryptos with certificateChain", {
      code: "cert_binding_chain_required",
      debug: { kryptosId: kryptos.id, mode },
      title: "Cert Binding Chain Required",
      details:
        "Certificate binding was requested, but the signing kryptos has no certificateChain to derive an x5t#S256 thumbprint from.",
    });
  }

  const fields: CertificateHeaderFields = {
    x5tS256: kryptos.certificateThumbprint ?? undefined,
  };

  if (resolved === "chain") {
    fields.x5c =
      kryptos.certificateChain.length > 0 ? kryptos.certificateChain : undefined;
  }

  return fields;
};
