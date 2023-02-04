import { ReverseMap } from "../utility";

export const OauthClientTypes = {
  CONFIDENTIAL: "confidential",
  PUBLIC: "public",
} as const;

export type OauthClientType = ReverseMap<typeof OauthClientTypes>;
