import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmSelectAccountRequestParams = StandardRequestParamsWithId;

export type ConfirmSelectAccountRequestBody = {
  selectExisting?: string;
  selectNew?: boolean;
};

export type ConfirmSelectAccountResponse = StandardResponseWithRedirectTo;
