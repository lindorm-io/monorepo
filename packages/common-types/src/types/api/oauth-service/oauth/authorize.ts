import { OpenIdDisplayMode, OpenIdResponseMode, PKCEMethod } from "../../../../enums";

export type AuthorizeRequestQuery = {
  acrValues?: string;
  amrValues?: string; // lindorm.io
  authToken?: string; // lindorm.io
  clientId: string;
  codeChallenge?: string;
  codeChallengeMethod?: PKCEMethod;
  country?: string; // lindorm.io
  display?: OpenIdDisplayMode;
  idTokenHint?: string;
  loginHint?: string;
  maxAge?: string;
  nonce?: string;
  prompt?: string;
  redirectData?: string; // lindorm.io
  redirectUri: string;
  responseMode?: OpenIdResponseMode;
  responseType: string;
  scope: string;
  state: string;
  uiLocales?: string;
};
