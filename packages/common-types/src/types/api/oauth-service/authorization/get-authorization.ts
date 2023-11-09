import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "../../../auth";
import { ScopeDescription } from "../../../global";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type SelectAccountSession = {
  selectId: string;
  identityId: string;
};

export type GetAuthorizationRequestParams = StandardRequestParamsWithId;

export type GetAuthorizationResponse = {
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

  selectAccount: {
    isRequired: boolean;
    status: SessionStatus;

    sessions: Array<SelectAccountSession>;
  };

  authorizationSession: {
    id: string;
    country: string | null;
    displayMode: OpenIdDisplayMode;
    expires: string;
    idTokenHint: string | null;
    loginHint: Array<string>;
    maxAge: number | null;
    nonce: string;
    originalUri: string;
    promptModes: Array<OpenIdPromptMode>;
    redirectUri: string;
    uiLocales: Array<string>;
  };

  browserSession: {
    id: string | null;
    adjustedAccessLevel: AdjustedAccessLevel;
    factors: Array<AuthenticationFactor>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    remember: boolean;
    singleSignOn: boolean;
    strategies: Array<AuthenticationStrategy>;
  };

  clientSession: {
    id: string | null;
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    factors: Array<AuthenticationFactor>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<Scope | string>;
    strategies: Array<AuthenticationStrategy>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
