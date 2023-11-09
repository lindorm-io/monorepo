import { SessionStatus } from "@lindorm-io/common-enums";

export type GetRdcStatusRequestParams = {
  id: string;
};

export type GetRdcStatusResponse = {
  status: SessionStatus;
};
