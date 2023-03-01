import { LindormIdentity } from "../../../identity";
import { StandardRequestParamsWithId } from "../../standard";

export type UpdateIdentityRequestParams = StandardRequestParamsWithId;

export type UpdateIdentityRequestBody = Pick<
  LindormIdentity,
  | "active"
  | "birthDate"
  | "displayName"
  | "familyName"
  | "gender"
  | "givenName"
  | "avatarUri"
  | "locale"
  | "middleName"
  | "namingSystem"
  | "nickname"
  | "picture"
  | "preferredAccessibility"
  | "profile"
  | "pronouns"
  | "takenName"
  | "website"
  | "zoneInfo"
>;
