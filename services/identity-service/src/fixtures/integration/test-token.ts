import { ClientPermission, ClientScope, IdentityPermission, Scope } from "../../common";
import { configuration } from "../../server/configuration";
import { createTestJwt, IssuerSignOptions } from "@lindorm-io/jwt";

export const getTestAccessToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    id: "a7534836-65f2-4e04-9f16-b5afebdcdd71",
    audiences: ["0438487d-0cf0-4399-b3d3-c2876db14ca6"],
    authMethodsReference: ["email"],
    expiry: "10 seconds",
    permissions: Object.values(IdentityPermission),
    scopes: Object.values(Scope),
    subject: "dcb17352-223e-4f4b-892c-b17a2ec09de2",
    subjectHint: "identity",
    type: "access_token",
    ...options,
  });
  return token;
};

export const getTestClientCredentials = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = createTestJwt({
    issuer: configuration.services.oauth_service.issuer,
  }).sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    expiry: "10 seconds",
    permissions: Object.values(ClientPermission),
    scopes: Object.values(ClientScope),
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: "client",
    type: "access_token",
    ...options,
  });
  return token;
};
