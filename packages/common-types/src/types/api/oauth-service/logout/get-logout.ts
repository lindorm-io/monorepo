import { OauthClientType } from "../../../oauth";

export type GetLogoutRequestParams = {
  id: string;
};

export type GetLogoutResponse = {
  logout: {
    accessSessionId: string | null;
    accessSessions: Array<string>;
    browserSessionId: string;
    refreshSessionId: string | null;
    refreshSessions: Array<string>;
  };

  client: {
    description: string | null;
    logoUri: string | null;
    name: string;
    type: OauthClientType;
  };

  logoutSession: {
    clientId: string | null;
    expiresAt: string;
    expiresIn: number;
    idTokenHint: string | null;
    identityId: string;
    logoutHint: string | null;
    originalUri: string;
    uiLocales: Array<string>;
  };
};
