import { CertificateMethod } from "@lindorm-io/common-enums";
import { createRsaSignature } from "@lindorm-io/crypto";
import { TEST_PRIVATE_KEY } from "./test-public-keys";

export const signTestChallenge = (method: CertificateMethod, challenge: string): string =>
  createRsaSignature({
    algorithm: method,
    data: challenge,
    format: "base64",
    key: TEST_PRIVATE_KEY,
  });
