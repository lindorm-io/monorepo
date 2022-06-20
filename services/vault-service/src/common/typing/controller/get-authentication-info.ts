import { ClientType, DisplayMode, SessionStatus } from "../../enum";
import { LevelOfAssurance } from "@lindorm-io/jwt";

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
    authToken: string | null;
    authenticationMethods: Array<string>;
    country: string | null;
    levelOfAssurance: LevelOfAssurance;
  };
}
