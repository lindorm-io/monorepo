import { AuthMethodConfig } from "../../../auth";
import { AuthenticationMode, SessionStatus } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationRequestParams = StandardRequestParamsWithId;

type CodeResponseBody = {
  code: string;
  mode: AuthenticationMode;
};

type PendingResponseBody = {
  config: Array<AuthMethodConfig>;
  emailHint: string | null;
  expires: Date;
  mode: AuthenticationMode;
  oidcProviders: Array<string>;
  phoneHint: string | null;
  status: SessionStatus;
};

export type GetAuthenticationResponse = CodeResponseBody | PendingResponseBody;
