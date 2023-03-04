import { PublicClientInfo } from "../public-client-info";
import { SessionStatus } from "../../../../enums";

export type GetLogoutRequestParams = {
  id: string;
};

export type GetLogoutResponse = {
  logout: {
    status: SessionStatus;

    browserSession: {
      id: string;
      connectedSessions: number;
    };
    clientSession: {
      id: string | null;
    };
  };

  client: PublicClientInfo;

  logoutSession: {
    expires: string;
    idTokenHint: string | null;
    identityId: string;
    logoutHint: string | null;
    originalUri: string;
    uiLocales: Array<string>;
  };
};
