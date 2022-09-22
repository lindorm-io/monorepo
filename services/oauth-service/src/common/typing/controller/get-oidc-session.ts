import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface GetOidcSessionResponseBody {
  callbackId: string;
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  provider: string;
}
