import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { LevelOfAssurance } from "../../../auth";
import { ScopeDescription } from "../../../global";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type GetBackchannelSessionRequestParams = StandardRequestParamsWithId;

export type GetBackchannelSessionResponse = {
  consent: {
    isRequired: boolean;
    status: SessionStatus;

    audiences: Array<string>;
    optionalScopes: Array<Scope | string>;
    requiredScopes: Array<Scope | string>;
    scopeDescriptions: Array<ScopeDescription>;
  };

  login: {
    isRequired: boolean;
    status: SessionStatus;

    factors: Array<AuthenticationFactor>;
    identityId: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    minimumLevelOfAssurance: LevelOfAssurance;
    strategies: Array<AuthenticationStrategy>;
  };

  backchannelSession: {
    id: string;
    bindingMessage: string | null;
    clientNotificationToken: string | null;
    expires: string;
    idTokenHint: string | null;
    loginHint: string | null;
    loginHintToken: string | null;
    requestedExpiry: number;
    userCode: string | null;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
