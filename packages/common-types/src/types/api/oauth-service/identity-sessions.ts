import { AdjustedAccessLevel, LevelOfAssurance } from "../../auth";
import { AuthenticationMethod, LindormScope, OpenIdScope } from "../../../enums";
import { PublicClientInfo } from "./public-client-info";
import { PublicTenantInfo } from "./public-tenant-info";

export type IdentitySessionItem = {
  id: string;
  adjustedAccessLevel: AdjustedAccessLevel;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  scopes: Array<OpenIdScope | LindormScope>;
  type: string;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export type GetIdentitySessionsResponse = {
  sessions: Array<IdentitySessionItem>;
};
