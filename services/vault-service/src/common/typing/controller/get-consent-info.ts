import { ClientType, DisplayMode, SessionStatus } from "../../enum";
import { ScopeDescription } from "../common";

export interface GetConsentInfoResponseBody {
  authorizationSession: {
    id: string;
    displayMode: DisplayMode;
    expiresAt: string;
    expiresIn: number;
    originalUri: string;
    promptModes: Array<string>;
    uiLocales: Array<string>;
  };
  client: {
    name: string;
    description: string;
    logoUri: string;
    requiredScopes: Array<string>;
    scopeDescriptions: Array<ScopeDescription>;
    type: ClientType;
  };
  consentRequired: boolean;
  consentSession: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
  consentStatus: SessionStatus;
  requested: {
    audiences: Array<string>;
    scopes: Array<string>;
  };
}
