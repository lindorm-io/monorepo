import { ClientType, DisplayMode } from "../enum";
import { LevelOfAssurance, ScopeDescription } from "./common";
import { SessionStatus } from "../../lindorm";

export interface ResponseWithRedirectBody {
  redirectTo: string;
}

export interface GetAuthenticationInfoResponseBody {
  authenticationRequired: boolean;
  authenticationStatus: SessionStatus;
  authorizationSession: {
    id: string;
    displayMode: DisplayMode;
    expiresAt: string;
    expiresIn: number;
    identityId: string | null;
    loginHint: Array<string>;
    originalUri: string;
    promptModes: Array<string>;
    uiLocales: Array<string>;
  };
  browserSession: {
    amrValues: Array<string>;
    country: string | null;
    identityId: string | null;
    levelOfAssurance: LevelOfAssurance;
    remember: boolean;
  };
  client: {
    name: string;
    description: string;
    logoUri: string;
    type: ClientType;
  };
  requested: {
    authenticationId: string | null;
    authenticationMethods: Array<string>;
    country: string | null;
    levelOfAssurance: LevelOfAssurance;
    pkceVerifier: string | null;
  };
}

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

export interface GetLogoutSessionInfoResponseBody {
  client: {
    name: string;
    description: string;
    logoUri: string;
    type: ClientType;
  };
  logoutSession: {
    id: string;
    expiresIn: number;
    expiresAt: string;
    originalUri: string;
  };
  logoutStatus: SessionStatus;
}

export interface IdentitySessionsData {
  id: string;
  levelOfAssurance: LevelOfAssurance;
}

export interface IdentitySessionsResponseBody {
  sessions: Array<IdentitySessionsData>;
}
