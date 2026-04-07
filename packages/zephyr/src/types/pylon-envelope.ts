export type PylonEnvelope = {
  __pylon: true;
  header: Record<string, unknown>;
  payload: unknown;
};

export type PylonAckOk = {
  __pylon: true;
  ok: true;
  data: any;
};

export type PylonAckNack = {
  __pylon: true;
  ok: false;
  error: {
    code?: string | number;
    data?: Record<string, unknown>;
    message?: string;
    title?: string;
  };
};

export type PylonAck = PylonAckOk | PylonAckNack;
