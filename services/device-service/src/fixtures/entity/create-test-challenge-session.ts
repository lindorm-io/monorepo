import { ChallengeStrategy } from "@lindorm-io/common-enums";
import { randomString } from "@lindorm-io/random";
import { ChallengeSession, ChallengeSessionOptions } from "../../entity";

export const createTestChallengeSession = (
  options: Partial<ChallengeSessionOptions> = {},
): ChallengeSession =>
  new ChallengeSession({
    audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902"],
    certificateChallenge:
      "fU8ob4kqvPCfVCd5FdaM0hpXvpRoBx3VlPEWGarUP8DvTMj4AcFgieq2HMeH3uXK7MggvmLnG5iGGhUVMqDRhd7fRzW1XVveJe3CI7Pf3HlQpzqIOmrHGxes3yjZY3Es",
    deviceLinkId: "4bfbd305-8296-427e-b212-7f4999181e58",
    expires: new Date("2023-01-01T08:00:00.000Z"),
    nonce: randomString(16),
    payload: { test: true },
    scopes: ["test"],
    strategies: Object.values(ChallengeStrategy),
    ...options,
  });
