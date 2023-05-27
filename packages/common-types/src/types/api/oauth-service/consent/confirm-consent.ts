import { LindormScope, OpenIdScope } from "../../../../enums";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmConsentRequestParams = StandardRequestParamsWithId;

export type ConfirmConsentRequestBody = {
  audiences: Array<string>;
  scopes: Array<OpenIdScope | LindormScope | string>;
};

export type ConfirmConsentResponse = StandardResponseWithRedirectTo;
