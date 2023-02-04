import { AuthenticationTokenType, AuthenticationTokenTypes } from "../auth";
import { DeviceTokenType, DeviceTokenTypes } from "../device";
import { OpenIdTokenType, OpenIdTokenTypes } from "../open-id";

export const LindormTokenTypes = {
  ...AuthenticationTokenTypes,
  ...DeviceTokenTypes,
  ...OpenIdTokenTypes,
} as const;

export type LindormTokenType = OpenIdTokenType & AuthenticationTokenType & DeviceTokenType;
