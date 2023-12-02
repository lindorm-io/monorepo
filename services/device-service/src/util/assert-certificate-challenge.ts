import { CertificateMethod } from "@lindorm-io/common-enums";
import { verifyRsaSignature } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";

interface Options {
  certificateChallenge: string;
  certificateMethod: CertificateMethod;
  certificateVerifier: string;
  publicKey: string;
}

export const assertCertificateChallenge = (options: Options): void => {
  const { certificateChallenge, certificateMethod, certificateVerifier, publicKey } = options;

  const valid = verifyRsaSignature({
    algorithm: certificateMethod,
    data: certificateChallenge,
    key: publicKey,
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
