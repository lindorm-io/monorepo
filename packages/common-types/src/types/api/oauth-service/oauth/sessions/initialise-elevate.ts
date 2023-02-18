import { AuthenticationMethod, LevelOfAssurance } from "../../../../auth";
import { OauthDisplayMode } from "../../../../oauth";

type InitialiseElevateRequestData = {
  authenticationHint?: Array<string>;
  clientId: string;
  country?: string;
  display?: OauthDisplayMode;
  idTokenHint?: string;
  levelOfAssurance?: LevelOfAssurance;
  nonce?: string;
};

export type InitialiseElevateRequestBody = InitialiseElevateRequestData & {
  methods?: Array<AuthenticationMethod>;
  uiLocales?: Array<string>;
};

export type InitialiseElevateRequestQuery = InitialiseElevateRequestData & {
  methods?: string;
  redirectUri: string;
  state: string;
  uiLocales?: string;
};

export type InitialiseElevateResponse = {
  elevationSessionId: string;
};
