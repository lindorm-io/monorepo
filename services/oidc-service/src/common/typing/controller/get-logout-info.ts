import { ClientType, SessionStatus } from "../../enum";

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
