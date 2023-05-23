import { AuthenticationMethod, OpenIdDisplayMode } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";

interface InitialiseElevationRequestData {
  authenticationHint?: Array<string>;
  clientId: string;
  country?: string;
  idTokenHint?: string;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
}

export interface InitialiseElevationRequestBody extends InitialiseElevationRequestData {
  methods?: Array<AuthenticationMethod>;
  uiLocales?: Array<string>;
}

export interface InitialiseElevationRequestQuery extends InitialiseElevationRequestData {
  display?: OpenIdDisplayMode;
  methods?: string;
  redirectUri: string;
  state: string;
  uiLocales?: string;
}

export interface InitialiseElevationResponse {
  elevationRequestId: string;
}
