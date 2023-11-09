import { Scope } from "@lindorm-io/common-enums";
import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmConsentRequestParams = StandardRequestParamsWithId;

export type ConfirmConsentRequestBody = {
  audiences: Array<string>;
  scopes: Array<Scope | string>;
};

export type ConfirmConsentResponse = StandardResponseWithRedirectTo;
