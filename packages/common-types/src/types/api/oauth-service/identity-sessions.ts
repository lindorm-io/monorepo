import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
} from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "../../auth";
import { PublicClientInfo } from "./public-client-info";
import { PublicTenantInfo } from "./public-tenant-info";

export type IdentitySessionItem = {
  id: string;
  adjustedAccessLevel: AdjustedAccessLevel;
  factors: Array<AuthenticationFactor>;
  latestAuthentication: string;
  levelOfAssurance: LevelOfAssurance;
  metadata: Record<string, any>;
  methods: Array<AuthenticationMethod>;
  scopes: Array<Scope | string>;
  strategies: Array<AuthenticationStrategy>;
  type: string;

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};

export type GetIdentitySessionsResponse = {
  sessions: Array<IdentitySessionItem>;
};
