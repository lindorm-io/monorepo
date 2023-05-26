import { AuthenticationMethod, OpenIdDisplayMode, SessionStatus } from "../../../../enums";
import { LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type GetElevationSessionRequestParams = StandardRequestParamsWithId;

export type GetElevationSessionResponse = {
  elevation: {
    isRequired: boolean;
    status: SessionStatus;

    minimumLevel: LevelOfAssurance;
    recommendedLevel: LevelOfAssurance;
    recommendedMethods: Array<AuthenticationMethod>;
    requiredLevel: LevelOfAssurance;
    requiredMethods: Array<AuthenticationMethod>;
  };

  elevationSession: {
    id: string;
    authenticationHint: Array<string>;
    country: string | null;
    displayMode: OpenIdDisplayMode;
    expires: string;
    idTokenHint: string | null;
    identityId: string;
    nonce: string;
    uiLocales: Array<string>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
