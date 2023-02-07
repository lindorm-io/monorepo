import { SessionStatus } from "../../../global";
import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type GetElevationRequestParams = StandardRequestParamsWithId;

export type GetElevationResponse = {
  elevationStatus: SessionStatus;
  elevationSession: {
    id: string;
    authenticationHint: Array<string>;
    country: string;
    expiresAt: string;
    expiresIn: number;
    identityId: string;
    nonce: string;
    uiLocales: Array<string>;
  };
  requested: {
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };
};
