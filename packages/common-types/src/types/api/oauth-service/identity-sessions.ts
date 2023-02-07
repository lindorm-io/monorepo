import { AdjustedAccessLevel, LevelOfAssurance } from "../../auth";

export type IdentitySessionItem = {
  id: string;
  adjustedAccessLevel: AdjustedAccessLevel;
  levelOfAssurance: LevelOfAssurance;
};

export type GetIdentitySessionsResponse = {
  sessions: Array<IdentitySessionItem>;
};
