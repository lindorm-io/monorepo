import { configuration } from "../server/configuration";
import { getJwt } from "./util/get-jwt";
import { logger } from "./util/logger";
import { ChallengeConfirmationTokenClaims } from "../common";
import {
  ChallengeStrategy,
  DeviceTokenType,
  PSD2Factor,
  SubjectHint,
} from "@lindorm-io/common-types";

const main = async (): Promise<void> => {
  const jwt = await getJwt();

  const { token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [],
    claims: {
      deviceLinkId: "bcc17443-5514-44bc-81bc-416a62e83e43",
      factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: "941f2885-0342-4677-9fdf-a1c371babbe1",
    payload: {},
    scopes: [],
    session: "b0bcc6d6-55c1-4965-bd67-f0bb1c981538",
    sessionHint: "challenge",
    subject: "acbfce9e-072b-450f-b451-5915cdd17a33",
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.CHALLENGE_CONFIRMATION,
  });

  logger.info("Generated token", { token });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
