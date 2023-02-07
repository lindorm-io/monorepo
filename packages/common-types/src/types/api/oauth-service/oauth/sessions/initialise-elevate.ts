import { AuthenticationMethod, LevelOfAssurance } from "../../../../auth";

export type InitialiseElevateRequestBody = {
  acrValue?: LevelOfAssurance;
  amrValues?: Array<AuthenticationMethod>;
  authenticationHint?: Array<string>;
  clientId: string;
  country?: string;
  idTokenHint?: string;
  nonce?: string;
  redirectUri?: string;
  state?: string;
  uiLocales?: Array<string>;
};

export type InitialiseElevateResponse = {
  elevationSessionId: string;
};
