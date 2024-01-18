import { CertificateMethod } from "@lindorm-io/common-enums";
import { RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { mapCertificateMethodToRsaAlgorithm } from "../../util/certificate-method-mapper";
import { RSA_KEY_SET } from "./rsa-keys.fixture";

export const signTestChallenge = (method: CertificateMethod, challenge: string): string =>
  createRsaSignature({
    algorithm: mapCertificateMethodToRsaAlgorithm(method),
    data: challenge,
    format: RsaFormat.BASE64,
    keySet: RSA_KEY_SET,
  });
