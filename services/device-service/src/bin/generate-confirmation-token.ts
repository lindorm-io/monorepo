import { configuration } from "../server/configuration";
import { getJwt } from "./util/get-jwt";
import { logger } from "./util/logger";
import { ChallengeConfirmationTokenClaims } from "../common";
import {
  ChallengeStrategies,
  LindormTokenTypes,
  PSD2Factors,
  SubjectHints,
} from "@lindorm-io/common-types";

const main = async (): Promise<void> => {
  const jwt = await getJwt();

  const { token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [],
    claims: {
      deviceLinkId: "bcc17443-5514-44bc-81bc-416a62e83e43",
      factors: [PSD2Factors.POSSESSION, PSD2Factors.KNOWLEDGE],
      strategy: ChallengeStrategies.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: "941f2885-0342-4677-9fdf-a1c371babbe1",
    payload: {},
    scopes: [],
    sessionId: "b0bcc6d6-55c1-4965-bd67-f0bb1c981538",
    subject: "acbfce9e-072b-450f-b451-5915cdd17a33",
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.CHALLENGE_CONFIRMATION,
  });

  logger.info("Generated token", { token });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
