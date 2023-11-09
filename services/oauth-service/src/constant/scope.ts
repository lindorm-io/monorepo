import { Scope } from "@lindorm-io/common-enums";
import { ScopeDescription } from "@lindorm-io/common-types";

export const SCOPE_OPENID: ScopeDescription = {
  name: Scope.OPENID,
  description: "Give the client access to your OpenID claims.",
};

export const SCOPE_ADDRESS: ScopeDescription = {
  name: Scope.ADDRESS,
  description: "Give the client access to your address.",
};

export const SCOPE_EMAIL: ScopeDescription = {
  name: Scope.EMAIL,
  description: "Give the client access to your email.",
};

export const SCOPE_PHONE: ScopeDescription = {
  name: Scope.PHONE,
  description: "Give the client access to your phone number.",
};

export const SCOPE_PROFILE: ScopeDescription = {
  name: Scope.PROFILE,
  description: "Give the client access to your profile information.",
};

export const SCOPE_OFFLINE_ACCESS: ScopeDescription = {
  name: Scope.OFFLINE_ACCESS,
  description: "Let the client stay signed in.",
};

export const SCOPE_ACCESSIBILITY: ScopeDescription = {
  name: Scope.ACCESSIBILITY,
  description: "Give the client access to your accessibility information.",
};

export const SCOPE_NATIONAL_IDENTITY_NUMBER: ScopeDescription = {
  name: Scope.NATIONAL_IDENTITY_NUMBER,
  description: "Give the client access to your national identity number.",
};

export const SCOPE_PUBLIC: ScopeDescription = {
  name: Scope.PUBLIC,
  description: "Give the client access to your public information.",
};

export const SCOPE_SOCIAL_SECURITY_NUMBER: ScopeDescription = {
  name: Scope.SOCIAL_SECURITY_NUMBER,
  description: "Give the client access to your social security number.",
};

export const SCOPE_USERNAME: ScopeDescription = {
  name: Scope.USERNAME,
  description: "Give the client access to your username.",
};
