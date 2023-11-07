import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  LindormScope,
  OpenIdDisplayMode,
  OpenIdScope,
  SessionStatus,
} from "../../../../enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type GetElevationSessionRequestParams = StandardRequestParamsWithId;

export type GetElevationSessionResponse = {
  elevation: {
    isRequired: boolean;
    status: SessionStatus;

    factors: Array<AuthenticationFactor>;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    minimumLevelOfAssurance: LevelOfAssurance;
    strategies: Array<AuthenticationStrategy>;
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

  browserSession: {
    id: string | null;
    adjustedAccessLevel: AdjustedAccessLevel;
    factors: Array<AuthenticationFactor>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    remember: boolean;
    singleSignOn: boolean;
    strategies: Array<AuthenticationStrategy>;
  };

  clientSession: {
    id: string | null;
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    factors: Array<AuthenticationFactor>;
    identityId: string | null;
    latestAuthentication: string | null;
    levelOfAssurance: LevelOfAssurance;
    methods: Array<AuthenticationMethod>;
    scopes: Array<OpenIdScope | LindormScope | string>;
    strategies: Array<AuthenticationStrategy>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
