import { createTestJwt, IssuerSignOptions } from "@lindorm-io/jwt";
import { TokenType } from "../../enum";
import { configuration } from "../../server/configuration";
import { SubjectHint } from "../../common";

export const getTestChallengeConfirmationToken = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.device_service.issuer,
  }).sign({
    audiences: ["ab3ef107-dcff-445b-b4f4-cec7ba9aee5c"],
    claims: {
      deviceLinkId: "caf67914-cc7a-41a3-bf8b-c5ca208594cf",
      factors: ["possession", "inherence"],
      strategy: "biometry",
    },
    expiry: new Date("2022-01-01T08:00:00.000Z"),
    nonce: "ecdca72bb4104416",
    payload: {},
    scopes: ["authentication"],
    sessionId: "973ac482-3d9c-4bdb-9d87-424a864c9f66",
    subject: "8fe70a6a-5c0c-4594-a353-f889b5ed9a7c",
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.CHALLENGE_CONFIRMATION_TOKEN,
    ...options,
  });
  return token;
};

export const getTestFlowSessionToken = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.server.issuer,
  }).sign({
    audiences: [configuration.oauth.client_id],
    expiry: new Date("2022-01-01T08:00:00.000Z"),
    subject: "5050be1c-4ca7-433e-a2b9-b671b5b42a86",
    subjectHint: SubjectHint.SESSION,
    type: TokenType.FLOW_SESSION,
    ...options,
  });
  return token;
};
