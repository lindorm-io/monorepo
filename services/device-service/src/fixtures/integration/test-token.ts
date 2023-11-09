import { ChallengeStrategy, PSD2Factor, SubjectHint, TokenType } from "@lindorm-io/common-enums";
import { JwtSignOptions, createTestJwt } from "@lindorm-io/jwt";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { ChallengeConfirmationTokenClaims, RdcSessionTokenClaims } from "../../common";
import { configuration } from "../../server/configuration";

export const getTestChallengeConfirmationToken = (
  options: Partial<JwtSignOptions<ChallengeConfirmationTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<ChallengeConfirmationTokenClaims>({
    audiences: [configuration.oauth.client_id],
    claims: {
      deviceLinkId: "id",
      ext: { generated: true },
      factors: [PSD2Factor.POSSESSION, PSD2Factor.KNOWLEDGE],
      strategy: ChallengeStrategy.PINCODE,
    },
    expiry: configuration.defaults.challenge_confirmation_token_expiry,
    nonce: randomHex(16),
    scopes: ["test"],
    session: randomUUID(),
    sessionHint: "challenge",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION,
    ...options,
  });
  return token;
};

export const getTestChallengeSessionToken = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.challenge_session_expiry,
    session: randomUUID(),
    sessionHint: "challenge",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE,
    ...options,
  });
  return token;
};

export const getTestEnrolmentSessionToken = (options: Partial<JwtSignOptions> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: configuration.defaults.enrolment_session_expiry,
    session: randomUUID(),
    sessionHint: "enrolment",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.ENROLMENT,
    ...options,
  });
  return token;
};

export const getTestRdcToken = (
  options: Partial<JwtSignOptions<RdcSessionTokenClaims>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign<RdcSessionTokenClaims>({
    audiences: [configuration.oauth.client_id],
    claims: {
      ext: {},
    },
    expiry: configuration.defaults.remote_device_challenge_session_expiry,
    session: randomUUID(),
    sessionHint: "rdc",
    subject: randomUUID(),
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REMOTE_DEVICE_CHALLENGE,
    ...options,
  });
  return token;
};
