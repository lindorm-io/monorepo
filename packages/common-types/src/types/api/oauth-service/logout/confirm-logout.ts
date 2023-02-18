import { StandardRequestParamsWithId, StandardResponseWithRedirectTo } from "../../standard";

export type ConfirmLogoutRequestParams = StandardRequestParamsWithId;

export type ConfirmLogoutRequestBody = {
  accessSessionId: string | null;
  browserSessionId: string | null;
  refreshSessionId: string | null;
};

export type ConfirmLogoutResponse = StandardResponseWithRedirectTo;
