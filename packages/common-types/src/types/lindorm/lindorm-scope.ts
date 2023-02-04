import { OpenIdScope, OpenIdScopes } from "../open-id";
import { ReverseMap } from "../utility";

const CustomScopes = {
  ACCESSIBILITY: "accessibility",
  CONNECTED_PROVIDERS: "connected_providers",
  NATIONAL_IDENTITY_NUMBER: "national_identity_number",
  PUBLIC: "public",
  SOCIAL_SECURITY_NUMBER: "social_security_number",
  USERNAME: "username",
} as const;

type CustomScope = ReverseMap<typeof CustomScopes>;

export const LindormScopes = { ...OpenIdScopes, ...CustomScopes } as const;

export type LindormScope = OpenIdScope & CustomScope;
