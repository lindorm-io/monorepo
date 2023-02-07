import { LindormScopes, ScopeDescription } from "@lindorm-io/common-types";

export const SCOPE_OPENID: ScopeDescription = {
  name: LindormScopes.OPENID,
  description: "Give the client access to your OpenID claims.",
};

export const SCOPE_ADDRESS: ScopeDescription = {
  name: LindormScopes.ADDRESS,
  description: "Give the client access to your address.",
};

export const SCOPE_EMAIL: ScopeDescription = {
  name: LindormScopes.EMAIL,
  description: "Give the client access to your email.",
};

export const SCOPE_PHONE: ScopeDescription = {
  name: LindormScopes.PHONE,
  description: "Give the client access to your phone number.",
};

export const SCOPE_PROFILE: ScopeDescription = {
  name: LindormScopes.PROFILE,
  description: "Give the client access to your profile information.",
};

export const SCOPE_ACCESSIBILITY: ScopeDescription = {
  name: LindormScopes.ACCESSIBILITY,
  description: "Give the client access to your accessibility information.",
};

export const SCOPE_CONNECTED_PROVIDERS: ScopeDescription = {
  name: LindormScopes.CONNECTED_PROVIDERS,
  description: "Give the client access to a list of your connected providers.",
};

export const SCOPE_NATIONAL_IDENTITY_NUMBER: ScopeDescription = {
  name: LindormScopes.NATIONAL_IDENTITY_NUMBER,
  description: "Give the client access to your national identity number.",
};

export const SCOPE_SOCIAL_SECURITY_NUMBER: ScopeDescription = {
  name: LindormScopes.SOCIAL_SECURITY_NUMBER,
  description: "Give the client access to your social security number.",
};

export const SCOPE_USERNAME: ScopeDescription = {
  name: LindormScopes.USERNAME,
  description: "Give the client access to your username.",
};

export const SCOPE_OFFLINE_ACCESS: ScopeDescription = {
  name: LindormScopes.OFFLINE_ACCESS,
  description: "Let the client stay signed in.",
};
