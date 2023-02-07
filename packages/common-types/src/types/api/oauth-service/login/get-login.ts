import { SessionStatus } from "../../../global";
import { OauthClientType, OauthDisplayMode, OauthPromptMode } from "../../../oauth";
import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type GetLoginRequestParams = StandardRequestParamsWithId;

export type GetLoginResponse = {
  loginRequired: boolean;
  loginStatus: SessionStatus;
  authorizationSession: {
    id: string;
    authToken: string;
    country: string;
    displayMode: OauthDisplayMode;
    expiresAt: string;
    expiresIn: number;
    loginHint: Array<string>;
    nonce: string;
    originalUri: string;
    promptModes: Array<OauthPromptMode>;
    uiLocales: Array<string>;
  };
  browserSession: {
    amrValues: Array<AuthenticationMethod>;
    country: string;
    identityId: string;
    levelOfAssurance: LevelOfAssurance;
    remember: boolean;
  };
  client: {
    description: string;
    logoUri: string;
    name: string;
    type: OauthClientType;
  };
  requested: {
    identityId: string;
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };
};
