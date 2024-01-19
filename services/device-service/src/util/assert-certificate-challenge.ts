import { CertificateMethod } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { verifyRsaSignature } from "@lindorm-io/rsa";
import { PublicKey } from "../entity";
import { mapCertificateMethodToRsaAlgorithm } from "./certificate-method-mapper";

interface Options {
  certificateChallenge: string;
  certificateMethod: CertificateMethod;
  certificateVerifier: string;
  publicKey: PublicKey;
}

export const assertCertificateChallenge = (options: Options): void => {
  const { certificateChallenge, certificateMethod, certificateVerifier, publicKey } = options;

  const valid = verifyRsaSignature({
    algorithm: mapCertificateMethodToRsaAlgorithm(certificateMethod),
    data: certificateChallenge,
    keySet: publicKey.keySet,
    signature: certificateVerifier,
  });

  if (valid) return;

  throw new ClientError("Conflict", {
    debug: {
      certificateChallenge,
      certificateVerifier,
    },
    description: "Invalid certificate verifier",
    statusCode: ClientError.StatusCode.CONFLICT,
  });
};
