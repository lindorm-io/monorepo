import { LindormScope, OpenIdScope, ScopeDescription } from "@lindorm-io/common-types";

export const SCOPE_OPENID: ScopeDescription = {
  name: OpenIdScope.OPENID,
  description: "Give the client access to your OpenID claims.",
};

export const SCOPE_ADDRESS: ScopeDescription = {
  name: OpenIdScope.ADDRESS,
  description: "Give the client access to your address.",
};

export const SCOPE_EMAIL: ScopeDescription = {
  name: OpenIdScope.EMAIL,
  description: "Give the client access to your email.",
};

export const SCOPE_PHONE: ScopeDescription = {
  name: OpenIdScope.PHONE,
  description: "Give the client access to your phone number.",
};

export const SCOPE_PROFILE: ScopeDescription = {
  name: OpenIdScope.PROFILE,
  description: "Give the client access to your profile information.",
};

export const SCOPE_OFFLINE_ACCESS: ScopeDescription = {
  name: OpenIdScope.OFFLINE_ACCESS,
  description: "Let the client stay signed in.",
};

export const SCOPE_ACCESSIBILITY: ScopeDescription = {
  name: LindormScope.ACCESSIBILITY,
  description: "Give the client access to your accessibility information.",
};

export const SCOPE_NATIONAL_IDENTITY_NUMBER: ScopeDescription = {
  name: LindormScope.NATIONAL_IDENTITY_NUMBER,
  description: "Give the client access to your national identity number.",
};

export const SCOPE_PUBLIC: ScopeDescription = {
  name: LindormScope.PUBLIC,
  description: "Give the client access to your public information.",
};

export const SCOPE_SOCIAL_SECURITY_NUMBER: ScopeDescription = {
  name: LindormScope.SOCIAL_SECURITY_NUMBER,
  description: "Give the client access to your social security number.",
};

export const SCOPE_USERNAME: ScopeDescription = {
  name: LindormScope.USERNAME,
  description: "Give the client access to your username.",
};
