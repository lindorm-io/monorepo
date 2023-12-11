import { Scope } from "@lindorm-io/common-enums";
import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmBackchannelConsentRequestParams = StandardRequestParamsWithId;

export type ConfirmBackchannelConsentRequestBody = {
  audiences: Array<string>;
  scopes: Array<Scope | string>;
};
