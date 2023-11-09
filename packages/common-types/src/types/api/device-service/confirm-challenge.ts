import { ChallengeStrategy } from "@lindorm-io/common-enums";

export type ConfirmChallengeRequestParams = {
  id: string;
};

export type ConfirmChallengeRequestBody = {
  biometry: string;
  certificateVerifier: string;
  challengeSessionToken: string;
  pincode: string;
  strategy: ChallengeStrategy;
};

export type ConfirmChallengeResponse = {
  challengeConfirmationToken: string;
  expiresIn: number;
};
