import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmConsentRequestParams = StandardRequestParamsWithId;

export type ConfirmConsentRequestBody = {
  audiences: Array<string>;
  scopes: Array<string>;
};

export type ConfirmConsentResponse = StandardResponseWithRedirectTo;
