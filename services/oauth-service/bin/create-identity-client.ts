import { ClientPermission, ClientScope, ClientType, GrantType } from "../src/enum";
// @ts-ignore
import { createClient } from "./util/create-client";
import { config } from "dotenv";

config();

createClient({
  allowed: {
    grantTypes: [GrantType.CLIENT_CREDENTIALS],
    responseTypes: [],
    scopes: [ClientScope.COMMUNICATION_SEND],
  },
  description: "Identity Service for lindorm.io",
  host: process.env.IDENTITY_SERVICE,
  logoutUri: new URL("/ignored", process.env.IDENTITY_SERVICE).toString(),
  name: "Identity Service",
  owners: [],
  permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
  redirectUri: new URL("/ignored", process.env.IDENTITY_SERVICE).toString(),
  type: ClientType.CONFIDENTIAL,
})
  .catch(console.error)
  .finally(() => process.exit(0));
