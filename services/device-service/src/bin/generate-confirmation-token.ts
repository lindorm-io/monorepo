import { TokenType } from "../enum";
import { configuration } from "../server/configuration";
import { getTokenIssuer } from "./util/get-token-issuer";
import { logger } from "./util/logger";
import {
  ChallengeConfirmationTokenClaims,
  ChallengeStrategy,
  DeviceFactor,
  SubjectHint,
} from "../common";

const main = async (): Promise<void> => {
  const jwt = await getTokenIssuer();

  const { token } = jwt.sign<Record<string, unknown>, ChallengeConfirmationTokenClaims>({
    audiences: [],
    claims: {
      deviceLinkId: "bcc17443-5514-44bc-81bc-416a62e83e43",
      factors: [DeviceFactor.POSSESSION, DeviceFactor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: "941f2885-0342-4677-9fdf-a1c371babbe1",
    payload: {},
    scopes: [],
    sessionId: "b0bcc6d6-55c1-4965-bd67-f0bb1c981538",
    subject: "acbfce9e-072b-450f-b451-5915cdd17a33",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
  });

  logger.info("Generated token", { token });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
