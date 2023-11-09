import { CertificateMethod } from "@lindorm-io/common-enums";

export type InitialiseEnrolmentRequestBody = {
  audiences?: Array<string>;
  brand: string | null;
  buildId: string | null;
  buildNumber: string | null;
  certificateMethod: CertificateMethod;
  macAddress: string | null;
  model: string | null;
  publicKey: string;
  systemName: string | null;
};

export type InitialiseEnrolmentResponse = {
  certificateChallenge: string;
  enrolmentSessionId: string;
  enrolmentSessionToken: string;
  expires: string;
  externalChallengeRequired: boolean;
};
