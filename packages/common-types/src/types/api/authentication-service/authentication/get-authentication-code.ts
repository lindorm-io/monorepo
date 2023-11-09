import { AuthenticationMode } from "@lindorm-io/common-enums";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationCodeRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationCodeResponse = {
  code: string;
  mode: AuthenticationMode;
};
