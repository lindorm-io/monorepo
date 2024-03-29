import { AuthenticationMode, SessionStatus } from "@lindorm-io/common-enums";
import { AuthMethodConfig } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationResponse = {
  config: Array<AuthMethodConfig>;
  expires: string;
  mode: AuthenticationMode;
  federationProviders: Array<string>;
  status: SessionStatus;
};
