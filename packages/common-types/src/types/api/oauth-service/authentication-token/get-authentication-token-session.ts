import { LindormScope, OpenIdScope } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";
import { PublicClientInfo } from "../public-client-info";
import { PublicTenantInfo } from "../public-tenant-info";

export type GetAuthenticationTokenSessionRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationTokenSessionResponse = {
  authenticationTokenSession: {
    id: string;
    audiences: Array<string>;
    expires: string;
    metadata: Record<string, any>;
    scopes: Array<OpenIdScope | LindormScope>;
    token: string;
  };

  client: PublicClientInfo;
  tenant: PublicTenantInfo;
};
