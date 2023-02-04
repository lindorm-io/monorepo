import { ReverseMap } from "../utility";

export const OauthClientTypeEnum = {
  CONFIDENTIAL: "confidential",
  PUBLIC: "public",
} as const;

export type OauthClientType = ReverseMap<typeof OauthClientTypeEnum>;
