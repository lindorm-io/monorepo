import { Dict } from "@lindorm/types";

export type PylonEnvelope = {
  __pylon: true;
  header: Dict;
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
    data?: Dict;
    message?: string;
    title?: string;
  };
};

export type PylonAck = PylonAckOk | PylonAckNack;
