import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLoginRequestParams = StandardRequestParamsWithId;

export type ConfirmLoginRequestBody = {
  acrValues: Array<string>;
  amrValues: Array<AuthenticationMethod>;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  remember: boolean;
};

export type ConfirmLoginResponse = StandardResponseWithRedirectTo;
