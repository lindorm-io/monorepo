type LindormScope =
  | "accessibility"
  | "auth"
  | "geo_location"
  | "identity_providers"
  | "instant_messaging"
  | "legal"
  | "national_identity_number"
  | "social_networks"
  | "social_security_number"
  | "work_profile";

type StandardScope =
  | "address"
  | "email"
  | "offline_access"
  | "openid"
  | "phone"
  | "profile";

export type OpenIdScope = LindormScope | StandardScope;
