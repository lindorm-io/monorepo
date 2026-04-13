import { IKryptos } from "@lindorm/kryptos";
import { AegisError } from "../../errors";
import { BindCertificateMode, CertificateHeaderFields } from "../../types";

export const resolveCertBinding = (
  kryptos: IKryptos,
  mode: BindCertificateMode | undefined,
): CertificateHeaderFields | undefined => {
  if (!mode) return undefined;

  if (!kryptos.x5c) {
    throw new AegisError(
      "bindCertificate requires a signing kryptos with a certificateChain",
      { debug: { kryptosId: kryptos.id, mode } },
    );
  }

  const fields: CertificateHeaderFields = {
    x5tS256: kryptos.x5tS256,
    x5t: kryptos.x5t,
  };

  if (mode === "chain") {
    fields.x5c = kryptos.x5c;
  }

  return fields;
};
