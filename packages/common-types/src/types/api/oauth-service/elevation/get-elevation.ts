import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { OauthClientType, OauthDisplayMode } from "../../../oauth";
import { StandardRequestParamsWithId } from "../../standard";

export type GetElevationRequestParams = StandardRequestParamsWithId;

export type GetElevationResponse = {
  elevation: {
    isRequired: boolean;
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };

  client: {
    description: string | null;
    logoUri: string | null;
    name: string;
    type: OauthClientType;
  };

  elevationSession: {
    authenticationHint: Array<string>;
    country: string | null;
    displayMode: OauthDisplayMode;
    expiresAt: string;
    expiresIn: number;
    idTokenHint: string | null;
    identityId: string;
    nonce: string;
    uiLocales: Array<string>;
  };
};
