import { OpenIdScope, OpenIdScopeEnum } from "../open-id";
import { ReverseMap } from "../utility";

const CustomScopeEnum = {
  ACCESSIBILITY: "accessibility",
  CONNECTED_PROVIDERS: "connected_providers",
  NATIONAL_IDENTITY_NUMBER: "national_identity_number",
  PUBLIC: "public",
  SOCIAL_SECURITY_NUMBER: "social_security_number",
  USERNAME: "username",
} as const;

type CustomScope = ReverseMap<typeof CustomScopeEnum>;

export const LindormScopeEnum = { ...OpenIdScopeEnum, ...CustomScopeEnum } as const;

export type LindormScope = OpenIdScope & CustomScope;
