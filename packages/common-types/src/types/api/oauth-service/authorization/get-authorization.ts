import { AdjustedAccessLevel, AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { OauthClientType, OauthDisplayMode, OauthPromptMode } from "../../../oauth";
import { ScopeDescription } from "../../../global";
import { StandardRequestParamsWithId } from "../../standard";

export type SelectAccountSession = {
  selectId: string;
  identityId: string;
};

export type GetAuthorizationRequestParams = StandardRequestParamsWithId;

export type GetAuthorizationResponse = {
  consent: {
    isRequired: boolean;
    audiences: Array<string>;
    scopes: Array<string>;
  };

  login: {
    isRequired: boolean;
    identityId: string | null;
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };

  selectAccount: {
    isRequired: boolean;
    sessions: Array<SelectAccountSession>;
  };

  accessSession: {
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    identityId: string | null;
    latestAuthentication: Date | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<string>;
  };

  authorizationSession: {
    authToken: string | null;
    country: string | null;
    displayMode: OauthDisplayMode;
    expiresAt: string;
    expiresIn: number;
    idTokenHint: string | null;
    loginHint: Array<string>;
    maxAge: number | null;
    nonce: string;
    originalUri: string;
    promptModes: Array<OauthPromptMode>;
    redirectUri: string;
    uiLocales: Array<string>;
  };

  browserSession: {
    adjustedAccessLevel: AdjustedAccessLevel;
    identityId: string | null;
    latestAuthentication: Date | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    remember: boolean;
    sso: boolean;
  };

  client: {
    description: string | null;
    logoUri: string | null;
    name: string;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: OauthClientType;
  };

  refreshSession: {
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    identityId: string | null;
    latestAuthentication: Date | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<string>;
  };
};
