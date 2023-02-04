import { AuthenticationTokenType, AuthenticationTokenTypeEnum } from "../auth";
import { DeviceTokenType, DeviceTokenTypeEnum } from "../device";
import { OpenIdTokenType, OpenIdTokenTypeEnum } from "../open-id";

export const LindormTokenTypeEnum = {
  ...AuthenticationTokenTypeEnum,
  ...DeviceTokenTypeEnum,
  ...OpenIdTokenTypeEnum,
} as const;

export type LindormTokenType = OpenIdTokenType & AuthenticationTokenType & DeviceTokenType;
