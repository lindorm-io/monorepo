export type GetPendingRdcRequestParams = {
  id: string;
};

export type PendingRdcSession = {
  id: string;
  expiresIn: number;
};

export type GetPendingRdcResponse = {
  sessions: Array<PendingRdcSession>;
};
