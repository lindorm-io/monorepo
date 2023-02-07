import { SessionStatus } from "../../global";

export type GetRdcStatusRequestParams = {
  id: string;
};

export type GetRdcStatusResponse = {
  status: SessionStatus;
};
