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
    authenticationMethods: Array<AuthenticationMethod>;
    levelHint: LevelOfAssurance;
    levelOfAssurance: LevelOfAssurance;
    methodHint: Array<AuthenticationMethod>;
    missingAccessLevel: LevelOfAssurance;
  };
}
