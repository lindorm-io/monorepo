import { SessionStatus } from "../../../global";
import { OauthClientType } from "../../../oauth";

export type GetLogoutRequestParams = {
  id: string;
};

export type GetLogoutResponse = {
  client: {
    description: string;
    logoUri: string;
    name: string;
    type: OauthClientType;
  };
  logoutSession: {
    id: string;
    expiresAt: string;
    expiresIn: number;
    originalUri: string;
  };
  logoutStatus: SessionStatus;
};
