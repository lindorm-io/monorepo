import { AuthenticationMethod, ClientType, DisplayMode, SessionStatus } from "../../enum";
import { LevelOfAssurance } from "@lindorm-io/jwt";

export interface GetLoginDataResponseBody {
  loginRequired: boolean;
  loginStatus: SessionStatus;
  authorizationSession: {
    id: string;
    authToken: string | null;
    country: string | null;
    displayMode: DisplayMode;
    expiresAt: string;
    expiresIn: number;
    loginHint: Array<string>;
    nonce: string | null;
    originalUri: string;
    promptModes: Array<string>;
    uiLocales: Array<string>;
  };
  browserSession: {
    amrValues: Array<AuthenticationMethod>;
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
    identityId: string | null;
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };
}
