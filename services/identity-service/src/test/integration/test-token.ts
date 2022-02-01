import { getTestJwt } from "./test-jwt";
import { IssuerSignOptions } from "@lindorm-io/jwt";
import { ClientPermission, ClientScope, Scope } from "../../common";

export const getTestAccessToken = (options: Partial<IssuerSignOptions<any, any>> = {}): string => {
  const jwt = getTestJwt();
  const { token } = jwt.sign({
    id: "a7534836-65f2-4e04-9f16-b5afebdcdd71",
    audiences: ["0438487d-0cf0-4399-b3d3-c2876db14ca6"],
    authMethodsReference: ["email"],
    expiry: "10 seconds",
    permissions: ["permission"],
    scopes: [
      Scope.OPENID,
      Scope.ACCESSIBILITY,
      Scope.ADDRESS,
      Scope.CONNECTED_PROVIDERS,
      Scope.EMAIL,
      Scope.NATIONAL_IDENTITY_NUMBER,
      Scope.PHONE,
      Scope.PROFILE,
      Scope.SOCIAL_SECURITY_NUMBER,
      Scope.USERNAME,
    ],
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
  const { token } = getTestJwt().sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    expiry: "10 seconds",
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [
      ClientScope.IDENTIFIER_READ,
      ClientScope.IDENTIFIER_WRITE,
      ClientScope.IDENTITY_READ,
      ClientScope.IDENTITY_WRITE,
    ],
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: "client",
    type: "access_token",
    ...options,
  });

  return token;
};
