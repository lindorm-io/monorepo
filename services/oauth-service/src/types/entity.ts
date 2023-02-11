import {
  LevelOfAssurance,
  OauthDisplayMode,
  OauthGrantType,
  OauthResponseMode,
  OauthResponseType,
} from "@lindorm-io/common-types";

export type ClientAllowed = {
  grantTypes: Array<OauthGrantType>;
  responseTypes: Array<OauthResponseType>;
  scopes: Array<string>;
};

export type ClientDefaults = {
  audiences: Array<string>;
  displayMode: OauthDisplayMode;
  levelOfAssurance: LevelOfAssurance;
  responseMode: OauthResponseMode;
};

export type ClientExpiry = {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
};
