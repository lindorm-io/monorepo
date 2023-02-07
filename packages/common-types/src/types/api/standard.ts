import { SessionStatus } from "../global";

export type StandardRequestParamsWithId = {
  id: string;
};

export type StandardResponseWithRedirectTo = {
  redirectTo: string;
};

export type StandardResponseWithStatus = {
  status: SessionStatus;
};
