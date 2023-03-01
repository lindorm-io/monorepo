import {
  LevelOfAssurance,
  LindormScope,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm-io/common-types";

export type ClientAllowed = {
  grantTypes: Array<OpenIdGrantType>;
  responseTypes: Array<OpenIdResponseType>;
  scopes: Array<OpenIdScope | LindormScope>;
};

export type ClientDefaults = {
  audiences: Array<string>;
  displayMode: OpenIdDisplayMode;
  levelOfAssurance: LevelOfAssurance;
  responseMode: OpenIdResponseMode;
};

export type ClientExpiry = {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
};
