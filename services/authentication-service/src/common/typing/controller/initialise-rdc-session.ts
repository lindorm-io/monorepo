import { RdcSessionMode, RequestMethod } from "../../enum";

export interface InitialiseRdcSessionRequestData {
  confirmMethod?: RequestMethod;
  confirmPayload?: Record<string, any>;
  confirmUri: string;
  expiresAt?: string;
  identityId?: string;
  factors?: number;
  mode: RdcSessionMode;
  nonce: string;
  rejectMethod?: RequestMethod;
  rejectPayload?: Record<string, any>;
  rejectUri: string;
  scopes?: Array<string>;
  templateName: string;
  templateParameters?: Record<string, any>;
  tokenPayload?: Record<string, any>;
}

export interface InitialiseRdcSessionResponseBody {
  id: string;
  expiresIn: number;
}
