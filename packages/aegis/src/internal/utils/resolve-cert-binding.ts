import { IKryptos } from "@lindorm/kryptos";
import { AegisError } from "../../errors";
import { BindCertificateMode, CertificateHeaderFields } from "../../types";

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
    throw new AegisError(
      "bindCertificate requires a signing kryptos with a certificateChain",
      { debug: { kryptosId: kryptos.id, mode } },
    );
  }

  const fields: CertificateHeaderFields = {
    x5tS256: kryptos.x5tS256,
    x5t: kryptos.x5t,
  };

  if (resolved === "chain") {
    fields.x5c = kryptos.x5c;
  }

  return fields;
};
