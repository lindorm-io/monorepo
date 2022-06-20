import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface GetOidcSessionResponseBody {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  provider: string;
}
