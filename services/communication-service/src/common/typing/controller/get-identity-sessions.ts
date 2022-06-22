import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface IdentitySessionsData {
  id: string;
  adjustedAccessLevel: LevelOfAssurance;
  levelOfAssurance: LevelOfAssurance;
}

export interface GetIdentitySessionsResponseBody {
  sessions: Array<IdentitySessionsData>;
}
