import { PublicClientInfo } from "../public-client-info";
import { SessionStatus } from "../../../../enums";
import { PublicTenantInfo } from "../public-tenant-info";

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

  logoutSession: {
    id: string;
    expires: string;
    idTokenHint: string | null;
    identityId: string;
    logoutHint: string | null;
    originalUri: string;
    uiLocales: Array<string>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
