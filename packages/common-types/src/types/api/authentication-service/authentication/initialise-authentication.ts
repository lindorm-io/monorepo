import { AuthenticationMethod, PKCEMethod } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";

export type InitialiseAuthenticationRequestBody = {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  loginHint?: Array<string>;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  elevationSessionId?: string;
  oauthSessionId?: string;
};

export type InitialiseAuthenticationResponse = {
  id: string;
};
