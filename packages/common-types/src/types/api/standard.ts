import { SessionStatus } from "../../enums";

export type StandardRequestParamsWithId = {
  id: string;
};

export type StandardResponseWithRedirectTo = {
  redirectTo: string;
};

export type StandardResponseWithSessionStatus = {
  status: SessionStatus;
};
