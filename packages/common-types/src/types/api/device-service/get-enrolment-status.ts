import { SessionStatus } from "../../global";

export type GetEnrolmentStatusRequestParams = {
  id: string;
};

export type GetEnrolmentStatusResponse = {
  status: SessionStatus;
};
