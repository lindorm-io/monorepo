import { LevelOfAssurance } from "../../../auth";
import { PublicClientInfo } from "../public-client-info";
import { StandardRequestParamsWithId } from "../../standard";
import { AuthenticationMethod, OpenIdDisplayMode, SessionStatus } from "../../../../enums";

export type GetElevationRequestParams = StandardRequestParamsWithId;

export type GetElevationResponse = {
  elevation: {
    isRequired: boolean;
    status: SessionStatus;

    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };

  client: PublicClientInfo;

  elevationSession: {
    authenticationHint: Array<string>;
    country: string | null;
    displayMode: OpenIdDisplayMode;
    expiresAt: string;
    expiresIn: number;
    idTokenHint: string | null;
    identityId: string;
    nonce: string;
    uiLocales: Array<string>;
  };
};
