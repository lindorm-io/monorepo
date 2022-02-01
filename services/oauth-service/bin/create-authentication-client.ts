import { ClientPermission, ClientScope, ClientType, GrantType } from "../src/enum";
// @ts-ignore
import { createClient } from "./util/create-client";
import { config } from "dotenv";

config();

createClient({
  allowed: {
    grantTypes: [GrantType.CLIENT_CREDENTIALS],
    responseTypes: [],
    scopes: [
      ClientScope.AUTHORIZATION_READ,
      ClientScope.AUTHORIZATION_WRITE,
      ClientScope.IDENTIFIER_READ,
      ClientScope.IDENTIFIER_WRITE,
      ClientScope.IDENTITY_READ,
      ClientScope.IDENTITY_WRITE,
      ClientScope.LOGOUT_READ,
      ClientScope.LOGOUT_WRITE,
    ],
  },
  description: "Authentication Service for lindorm.io",
  host: process.env.AUTHENTICATION_SERVICE,
  logoutUri: new URL("/callback/logout", process.env.AUTHENTICATION_SERVICE).toString(),
  name: "Authentication Service",
  owners: [],
  permissions: [
    ClientPermission.COMMUNICATION_CONFIDENTIAL,
    ClientPermission.DEVICE_CONFIDENTIAL,
    ClientPermission.IDENTITY_CONFIDENTIAL,
    ClientPermission.OAUTH_CONFIDENTIAL,
  ],
  redirectUri: new URL("/callback/redirect", process.env.AUTHENTICATION_SERVICE).toString(),
  type: ClientType.CONFIDENTIAL,
})
  .catch(console.error)
  .finally(() => process.exit(0));
