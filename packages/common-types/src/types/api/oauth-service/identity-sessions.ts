import { AdjustedAccessLevel, AuthenticationMethod, LevelOfAssurance } from "../../auth";

export type IdentitySessionItem = {
  id: string;
  adjustedAccessLevel: AdjustedAccessLevel;
  latestAuthentication: Date;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  scopes: Array<string>;
  type: string;
};

export type GetIdentitySessionsResponse = {
  sessions: Array<IdentitySessionItem>;
};
