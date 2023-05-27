import { AuthenticationMethod, LindormScope, OpenIdScope } from "../../../../enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type GetClaimsSessionRequestParams = StandardRequestParamsWithId;

export type GetClaimsSessionResponse = {
  claimsSession: {
    id: string;
    adjustedAccessLevel: AdjustedAccessLevel;
    audiences: Array<string>;
    expires: string;
    identityId: string;
    latestAuthentication: string;
    levelOfAssurance: LevelOfAssurance;
    metadata: Record<string, any>;
    methods: Array<AuthenticationMethod>;
    scopes: Array<OpenIdScope | LindormScope | string>;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
