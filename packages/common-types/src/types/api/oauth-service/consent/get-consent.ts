import { ScopeDescription, SessionStatus } from "../../../global";
import { OauthClientType, OauthDisplayMode, OauthPromptMode } from "../../../oauth";
import { StandardRequestParamsWithId } from "../../standard";

export type GetConsentRequestParams = StandardRequestParamsWithId;

export type GetConsentResponse = {
  consentRequired: boolean;
  consentStatus: SessionStatus;
  authorizationSession: {
    id: string;
    displayMode: OauthDisplayMode;
    expiresIn: number;
    expiresAt: string;
    originalUri: string;
    promptModes: Array<OauthPromptMode>;
    uiLocales: Array<string>;
  };
  client: {
    description: string;
    logoUri: string;
    name: string;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: OauthClientType;
  };
  consentSession: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
  requested: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
};
