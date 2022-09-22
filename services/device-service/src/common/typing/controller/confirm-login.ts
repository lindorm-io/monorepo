import { LevelOfAssurance } from "@lindorm-io/jwt";
import { AuthenticationMethod } from "../../enum";

export interface ConfirmLoginRequestBody {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  remember: boolean;
}
