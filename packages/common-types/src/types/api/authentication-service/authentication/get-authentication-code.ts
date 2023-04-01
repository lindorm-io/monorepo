import { AuthenticationMode } from "../../../../enums";
import { StandardRequestParamsWithId } from "../../standard";

export type GetAuthenticationCodeRequestParams = StandardRequestParamsWithId;

export type GetAuthenticationCodeResponse = {
  code: string;
  mode: AuthenticationMode;
};
