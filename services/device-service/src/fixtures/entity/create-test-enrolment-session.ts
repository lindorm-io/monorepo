import { CertificateMethod, SessionStatus } from "@lindorm-io/common-enums";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { EnrolmentSession, EnrolmentSessionOptions } from "../../entity";
import { RSA_KEY_SET } from "../integration/rsa-keys.fixture";

export const createTestEnrolmentSession = (
  options: Partial<EnrolmentSessionOptions> = {},
): EnrolmentSession =>
  new EnrolmentSession({
    audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902"],
    certificateChallenge:
      "fU8ob4kqvPCfVCd5FdaM0hpXvpRoBx3VlPEWGarUP8DvTMj4AcFgieq2HMeH3uXK7MggvmLnG5iGGhUVMqDRhd7fRzW1XVveJe3CI7Pf3HlQpzqIOmrHGxes3yjZY3Es",
    certificateMethod: CertificateMethod.SHA512,
    deviceMetadata: {
      brand: "Apple",
      buildId: "12A269",
      buildNumber: "89",
      macAddress: "0B:ED:A0:D5:5A:2D",
      model: "iPhone7,2",
      systemName: "iOS",
    },
    expires: new Date("2023-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    installationId: randomUUID(),
    name: "Test DeviceLink Name",
    nonce: randomString(16),
    publicKey: RSA_KEY_SET.export("pem").publicKey,
    status: SessionStatus.CONFIRMED,
    uniqueId: randomUUID(),
    ...options,
  });
