import { CertificateMethod } from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { RsaAlgorithm } from "@lindorm-io/rsa";

export const mapCertificateMethodToRsaAlgorithm = (method: CertificateMethod): RsaAlgorithm => {
  switch (method) {
    case CertificateMethod.RSA_SHA256:
      return RsaAlgorithm.RSA_SHA256;

    case CertificateMethod.RSA_SHA384:
      return RsaAlgorithm.RSA_SHA384;

    case CertificateMethod.RSA_SHA512:
      return RsaAlgorithm.RSA_SHA512;

    case CertificateMethod.SHA256:
      return RsaAlgorithm.SHA256;

    case CertificateMethod.SHA384:
      return RsaAlgorithm.SHA384;

    case CertificateMethod.SHA512:
      return RsaAlgorithm.SHA512;

    default:
      throw new ServerError("Unexpected certificate method");
  }
};

export const mapRsaAlgorithmToCertificateMethod = (algorithm: RsaAlgorithm): CertificateMethod => {
  switch (algorithm) {
    case RsaAlgorithm.RSA_SHA256:
      return CertificateMethod.RSA_SHA256;

    case RsaAlgorithm.RSA_SHA384:
      return CertificateMethod.RSA_SHA384;

    case RsaAlgorithm.RSA_SHA512:
      return CertificateMethod.RSA_SHA512;

    case RsaAlgorithm.SHA256:
      return CertificateMethod.SHA256;

    case RsaAlgorithm.SHA384:
      return CertificateMethod.SHA384;

    case RsaAlgorithm.SHA512:
      return CertificateMethod.SHA512;

    default:
      throw new ServerError("Unexpected RSA algorithm");
  }
};
