import { AuthMethodConfig } from "../../../auth";
import { AuthenticationMode, SessionStatus } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationResponse = {
  config: Array<AuthMethodConfig>;
  emailHint: string | null;
  expires: string;
  mode: AuthenticationMode;
  oidcProviders: Array<string>;
  phoneHint: string | null;
  status: SessionStatus;
};
