import { ChallengeStrategy } from "@lindorm-io/common-enums";

export type InitialiseChallengeRequestBody = {
  audiences?: Array<string>;
  deviceLinkId: string;
  identityId: string;
  nonce: string;
  payload: Record<string, any>;
  scopes: Array<string>;
};

export type InitialiseChallengeResponse = {
  certificateChallenge: string;
  challengeSessionId: string;
  challengeSessionToken: string;
  expires: string;
  strategies: Array<ChallengeStrategy>;
};
