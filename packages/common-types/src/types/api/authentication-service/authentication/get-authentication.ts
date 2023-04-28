import { AuthMethodConfig } from "../../../auth";
import { AuthenticationMode, SessionStatus } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationResponse = {
  config: Array<AuthMethodConfig>;
  expires: string;
  mode: AuthenticationMode;
  oidcProviders: Array<string>;
  status: SessionStatus;
};
