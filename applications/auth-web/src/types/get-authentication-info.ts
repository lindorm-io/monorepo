import { AuthenticationMode } from "../enum/AuthenticationMode";
import { SessionStatus } from "../enum/SessionStatus";
import { ClientConfig } from "./configuration";

export type CodeResponseBody = {
  code: string;
  mode: AuthenticationMode;
};

export type PendingResponseBody = {
  clientConfig: Array<ClientConfig>;
  emailHint: string | null;
  expires: Date;
  mode: AuthenticationMode;
  phoneHint: string | null;
  status: SessionStatus;
};
