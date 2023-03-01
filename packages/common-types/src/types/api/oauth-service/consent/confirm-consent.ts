import { LindormScope, OpenIdScope } from "../../../../enums";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmConsentRequestParams = StandardRequestParamsWithId;

export type ConfirmConsentRequestBody = {
  audiences: Array<string>;
  scopes: Array<OpenIdScope | LindormScope>;
};

export type ConfirmConsentResponse = StandardResponseWithRedirectTo;
