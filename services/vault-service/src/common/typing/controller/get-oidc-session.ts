import { LevelOfAssurance } from "../common";

export interface GetOidcSessionResponseBody {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  provider: string;
}
