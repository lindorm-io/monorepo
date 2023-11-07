import { LevelOfAssurance } from "../../auth";
import { StandardRequestParamsWithId } from "../standard";

export type GetFederationSessionRequestParams = StandardRequestParamsWithId;

export type GetFederationSessionResponse = {
  callbackId: string;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  provider: string;
};
