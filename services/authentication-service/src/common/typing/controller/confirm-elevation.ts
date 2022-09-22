import { LevelOfAssurance } from "@lindorm-io/jwt";
import { AuthenticationMethod } from "../../enum";

export interface ConfirmElevationRequestBody {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
}
