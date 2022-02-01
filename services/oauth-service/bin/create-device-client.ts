import { ClientPermission, ClientScope, ClientType, GrantType } from "../src/enum";
// @ts-ignore
import { createClient } from "./util/create-client";
import { config } from "dotenv";

config();

createClient({
  allowed: {
    grantTypes: [GrantType.CLIENT_CREDENTIALS],
    responseTypes: [],
    scopes: [ClientScope.COMMUNICATION_EMIT],
  },
  description: "Device Service for lindorm.io",
  host: process.env.DEVICE_SERVICE,
  logoutUri: new URL("/ignored", process.env.DEVICE_SERVICE).toString(),
  name: "Device Service",
  owners: [],
  permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
  redirectUri: new URL("/ignored", process.env.DEVICE_SERVICE).toString(),
  type: ClientType.CONFIDENTIAL,
})
  .catch(console.error)
  .finally(() => process.exit(0));
