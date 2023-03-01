import { PublicClientInfo } from "../public-client-info";
import { SessionStatus } from "../../../../enums";

export type GetLogoutRequestParams = {
  id: string;
};

export type GetLogoutResponse = {
  logout: {
    status: SessionStatus;

    accessSession: {
      id: string | null;
    };
    browserSession: {
      id: string;
      connectedSessions: number;
    };
    refreshSession: {
      id: string | null;
    };
  };

  client: PublicClientInfo;

  logoutSession: {
    expiresAt: string;
    expiresIn: number;
    idTokenHint: string | null;
    identityId: string;
    logoutHint: string | null;
    originalUri: string;
    uiLocales: Array<string>;
  };
};
