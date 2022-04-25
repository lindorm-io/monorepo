import { LevelOfAssurance } from "../common";

export interface ConfirmAuthenticationRequestBody {
  acrValues: Array<string>;
  amrValues: Array<string>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  remember: boolean;
}
