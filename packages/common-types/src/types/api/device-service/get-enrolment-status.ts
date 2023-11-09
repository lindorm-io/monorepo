import { SessionStatus } from "@lindorm-io/common-enums";

export type GetEnrolmentStatusRequestParams = {
  id: string;
};

export type GetEnrolmentStatusResponse = {
  status: SessionStatus;
};
