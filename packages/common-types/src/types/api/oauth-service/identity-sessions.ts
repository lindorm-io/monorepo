import { AdjustedAccessLevel, LevelOfAssurance } from "../../auth";
import { AuthenticationMethod, LindormScope, OpenIdScope } from "../../../enums";
import { PublicClientInfo } from "./public-client-info";

export type IdentitySessionItem = {
  id: string;
  client: PublicClientInfo;
  adjustedAccessLevel: AdjustedAccessLevel;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  scopes: Array<OpenIdScope | LindormScope>;
  type: string;
};

export type GetIdentitySessionsResponse = {
  sessions: Array<IdentitySessionItem>;
};
