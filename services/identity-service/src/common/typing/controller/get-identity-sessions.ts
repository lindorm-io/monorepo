import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface IdentitySessionsData {
  id: string;
  levelOfAssurance: LevelOfAssurance;
}

export interface GetIdentitySessionsResponseBody {
  sessions: Array<IdentitySessionsData>;
}
