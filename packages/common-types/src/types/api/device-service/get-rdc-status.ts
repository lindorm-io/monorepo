import { SessionStatus } from "../../../enums";

export type GetRdcStatusRequestParams = {
  id: string;
};

export type GetRdcStatusResponse = {
  status: SessionStatus;
};
