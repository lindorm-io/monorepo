import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmElevationRequestParams = StandardRequestParamsWithId;

export type ConfirmElevationRequestBody = {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
};
