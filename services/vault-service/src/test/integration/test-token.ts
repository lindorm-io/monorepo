import { ClientPermission, ClientScope } from "../../common";
import { IssuerSignOptions } from "@lindorm-io/jwt";
import { getTestJwt } from "./test-jwt";

export const getTestClientCredentials = (
  options: Partial<IssuerSignOptions<any, any>> = {},
): string => {
  const { token } = getTestJwt().sign({
    audiences: ["08e99132-09d5-4f87-a489-a62d2896a7bf"],
    expiry: "10 seconds",
    permissions: [ClientPermission.VAULT_CONFIDENTIAL, ClientPermission.VAULT_PUBLIC],
    scopes: [
      ClientScope.VAULT_ENCRYPTED_RECORD_READ,
      ClientScope.VAULT_ENCRYPTED_RECORD_WRITE,
      ClientScope.VAULT_JWKS_PRIVATE_READ,
      ClientScope.VAULT_JWKS_PUBLIC_READ,
      ClientScope.VAULT_PROTECTED_RECORD_READ,
      ClientScope.VAULT_PROTECTED_RECORD_WRITE,
    ],
    subject: "08e99132-09d5-4f87-a489-a62d2896a7bf",
    subjectHint: "client",
    type: "access_token",
    ...options,
  });

  return token;
};
