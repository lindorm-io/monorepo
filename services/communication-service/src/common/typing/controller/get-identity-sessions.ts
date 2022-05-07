import { LevelOfAssurance } from "../common";

export interface IdentitySessionsData {
  id: string;
  levelOfAssurance: LevelOfAssurance;
}

export interface GetIdentitySessionsResponseBody {
  sessions: Array<IdentitySessionsData>;
}
