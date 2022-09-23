import { LevelOfAssurance } from "@lindorm-io/jwt";
import { AuthenticationMethod, SessionStatus } from "../../enum";

export interface GetElevationDataResponseBody {
  elevationStatus: SessionStatus;
  elevationSession: {
    id: string;
    authenticationHint: Array<string>;
    country: string | null;
    expiresAt: string;
    expiresIn: number;
    identityId: string;
    nonce: string | null;
    uiLocales: Array<string>;
  };
  requested: {
    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };
}
