import { AdjustedAccessLevel, LevelOfAssurance } from "../../../auth";
import { PublicClientInfo } from "../public-client-info";
import { ScopeDescription } from "../../../global";
import { StandardRequestParamsWithId } from "../../standard";
import {
  AuthenticationMethod,
  LindormScope,
  OpenIdDisplayMode,
  OpenIdPromptMode,
  OpenIdScope,
  SessionStatus,
} from "../../../../enums";

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
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };

  selectAccount: {
    isRequired: boolean;
    status: SessionStatus;

    sessions: Array<SelectAccountSession>;
  };

  authorizationSession: {
    authToken: string | null;
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
    adjustedAccessLevel: AdjustedAccessLevel;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    remember: boolean;
    sso: boolean;
  };

  client: PublicClientInfo;

  clientSession: {
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<OpenIdScope | LindormScope>;
  };
};
