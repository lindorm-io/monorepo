import { LevelOfAssurance } from "../common";
import { PKCEMethod } from "@lindorm-io/core";

export interface InitialiseAuthenticationRequestData {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  loginHint?: Array<string>;
  methods?: Array<string>;
  nonce?: string;
  redirectUri?: string;
}

export interface InitialiseAuthenticationResponseBody {
  id: string;
}
