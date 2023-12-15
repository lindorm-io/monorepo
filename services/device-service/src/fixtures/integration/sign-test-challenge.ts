import { CertificateMethod } from "@lindorm-io/common-enums";
import { RsaFormat, createRsaSignature } from "@lindorm-io/rsa";
import { mapCertificateMethodToRsaAlgorithm } from "../../util/certificate-method-mapper";
import { TEST_PRIVATE_KEY } from "./test-public-keys";

export const signTestChallenge = (method: CertificateMethod, challenge: string): string =>
  createRsaSignature({
    algorithm: mapCertificateMethodToRsaAlgorithm(method),
    data: challenge,
    format: RsaFormat.BASE64,
    key: TEST_PRIVATE_KEY,
  });
