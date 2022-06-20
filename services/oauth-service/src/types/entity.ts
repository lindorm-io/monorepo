import { DisplayMode, GrantType, ResponseMode, ResponseType } from "../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface ClientAllowed {
  grantTypes: Array<GrantType>;
  responseTypes: Array<ResponseType>;
  scopes: Array<string>;
}

export interface ClientDefaults {
  audiences: Array<string>;
  displayMode: DisplayMode;
  levelOfAssurance: LevelOfAssurance;
  responseMode: ResponseMode;
}

export interface ClientExpiry {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}
