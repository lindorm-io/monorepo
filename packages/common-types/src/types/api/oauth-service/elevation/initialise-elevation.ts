import { AuthenticationMethod, OpenIdDisplayMode } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";

interface InitialiseElevationSessionRequestData {
  authenticationHint?: Array<string>;
  clientId: string;
  country?: string;
  idTokenHint?: string;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
}

export interface InitialiseElevationSessionRequestBody
  extends InitialiseElevationSessionRequestData {
  methods?: Array<AuthenticationMethod>;
  uiLocales?: Array<string>;
}

export interface InitialiseElevationSessionRequestQuery
  extends InitialiseElevationSessionRequestData {
  display?: OpenIdDisplayMode;
  methods?: string;
  redirectUri: string;
  state: string;
  uiLocales?: string;
}

export interface InitialiseElevationResponse {
  elevationSessionId: string;
}
