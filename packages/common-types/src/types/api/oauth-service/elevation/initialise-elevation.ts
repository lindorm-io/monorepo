import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdDisplayMode,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "../../../auth";

interface InitialiseElevationSessionRequestData {
  authenticationHint?: Array<string>;
  clientId: string;
  country?: string;
  idTokenHint?: string;
  nonce?: string;
}

export interface InitialiseElevationSessionRequestBody
  extends InitialiseElevationSessionRequestData {
  factors?: Array<AuthenticationFactor>;
  levelOfAssurance?: LevelOfAssurance;
  methods?: Array<AuthenticationMethod>;
  strategies?: Array<AuthenticationStrategy>;
  uiLocales?: Array<string>;
}

export interface InitialiseElevationSessionRequestQuery
  extends InitialiseElevationSessionRequestData {
  acrValues?: string;
  display?: OpenIdDisplayMode;
  redirectUri: string;
  state: string;
  uiLocales?: string;
}

export interface InitialiseElevationResponse {
  elevationSessionId: string;
}
