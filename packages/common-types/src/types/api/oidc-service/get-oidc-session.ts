import { StandardRequestParamsWithId } from "../standard";
import { LevelOfAssurance } from "../../auth";

export type GetOidcSessionRequestParams = StandardRequestParamsWithId;

export type GetOidcSessionResponse = {
  callbackId: string;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  provider: string;
};
