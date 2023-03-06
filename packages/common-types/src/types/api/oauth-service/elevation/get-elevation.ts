import { LevelOfAssurance } from "../../../auth";
import { PublicClientInfo } from "../public-client-info";
import { StandardRequestParamsWithId } from "../../standard";
import { AuthenticationMethod, OpenIdDisplayMode, SessionStatus } from "../../../../enums";
import { PublicTenantInfo } from "../public-tenant-info";

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
