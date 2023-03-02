import { RdcSessionMethod, RdcSessionMode } from "../../../enums";

export type InitialiseRdcSessionRequestBody = {
  audiences: Array<string>;
  confirmMethod?: RdcSessionMethod;
  confirmPayload?: Record<string, any>;
  confirmUri: string;
  expiresAt?: string;
  identityId?: string;
  factors?: number;
  mode: RdcSessionMode;
  nonce: string;
  rejectMethod?: RdcSessionMethod;
  rejectPayload?: Record<string, any>;
  rejectUri: string;
  scopes?: Array<string>;
  templateName: string;
  templateParameters?: Record<string, any>;
  tokenPayload?: Record<string, any>;
};

export type InitialiseRdcSessionResponse = {
  id: string;
  expires: string;
};
