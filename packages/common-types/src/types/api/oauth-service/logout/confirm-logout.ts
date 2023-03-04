import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLogoutRequestParams = StandardRequestParamsWithId;

export type ConfirmLogoutRequestBody = {
  browserSessionId: string | null;
  clientSessionId: string | null;
};

export type ConfirmLogoutResponse = StandardResponseWithRedirectTo;
