import { SessionStatus } from "../../../enums";

export type AcknowledgeRdcRequestParams = {
  id: string;
};

export type AcknowledgeRdcResponse = {
  id: string;
  challenge: {
    audiences: Array<string>;
    identityId: string;
    nonce: string;
    payload: Record<string, any>;
    scopes: Array<string>;
  };
  session: {
    expires: string;
    factors: number;
    rdcSessionToken: string;
    status: SessionStatus;
  };
  template: {
    name: string;
    parameters: Record<string, unknown>;
  };
};
