import { SessionStatus } from "../../../enums";

export type GetEnrolmentStatusRequestParams = {
  id: string;
};

export type GetEnrolmentStatusResponse = {
  status: SessionStatus;
};
