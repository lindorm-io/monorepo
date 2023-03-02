export type GetPendingRdcRequestParams = {
  id: string;
};

export type PendingRdcSession = {
  id: string;
  expires: string;
};

export type GetPendingRdcResponse = {
  sessions: Array<PendingRdcSession>;
};
