import {
  AuthenticationMethod,
  AuthenticationStrategy,
  LindormScope,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdScope,
  SessionStatus,
} from "../../../../enums";
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
    optionalScopes: Array<OpenIdScope | LindormScope>;
    requiredScopes: Array<OpenIdScope | LindormScope>;
    scopeDescriptions: Array<ScopeDescription>;
  };

  login: {
    isRequired: boolean;
    status: SessionStatus;

    identityId: string | null;
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    recommendedStrategies: Array<AuthenticationStrategy>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
    requiredStrategies: Array<AuthenticationStrategy>;
  };

  selectAccount: {
    isRequired: boolean;
    status: SessionStatus;

    sessions: Array<SelectAccountSession>;
  };

  authorizationRequest: {
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
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    remember: boolean;
    singleSignOn: boolean;
  };

  clientSession: {
    id: string | null;
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<OpenIdScope | LindormScope>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
