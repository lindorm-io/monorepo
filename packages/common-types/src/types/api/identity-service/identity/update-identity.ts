import { LindormIdentity } from "../../../identity";
import { StandardRequestParamsWithId } from "../../standard";

export type UpdateIdentityRequestParams = StandardRequestParamsWithId;

export type UpdateIdentityRequestBody = Pick<
  LindormIdentity,
  | "active"
  | "birthDate"
  | "avatarUri"
  | "displayName"
  | "familyName"
  | "gender"
  | "givenName"
  | "locale"
  | "middleName"
  | "namingSystem"
  | "nickname"
  | "picture"
  | "preferredAccessibility"
  | "preferredName"
  | "profile"
  | "pronouns"
  | "roles"
  | "website"
  | "zoneInfo"
>;
