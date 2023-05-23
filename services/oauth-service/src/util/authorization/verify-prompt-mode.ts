import { OpenIdPromptMode } from "@lindorm-io/common-types";
import { AuthorizationRequest } from "../../entity";

export const verifyPromptMode = (
  authorizationRequest: AuthorizationRequest,
  mode: OpenIdPromptMode,
): boolean => !authorizationRequest.promptModes.includes(mode);
