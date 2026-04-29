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
      debug: { kryptosId: kryptos.id, mode },
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
