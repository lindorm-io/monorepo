import { AuthenticationMethod } from "../../../enum";
import { LevelOfAssurance } from "../common";
import { PKCEMethod } from "@lindorm-io/core";

export interface InitialiseAuthenticationRequestData {
  clientId: string;
  codeChallenge: string;
  codeMethod: PKCEMethod;
  country?: string;
  identityId?: string;
  levelOfAssurance?: LevelOfAssurance;
  methods?: Array<AuthenticationMethod>;
  nonce?: string;
  redirectUri?: string;
}

export interface InitialiseAuthenticationResponseBody {
  id: string;
}
