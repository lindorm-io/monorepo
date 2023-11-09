import { OpenIdPromptMode } from "@lindorm-io/common-enums";
import { AuthorizationSession } from "../../entity";

export const verifyPromptMode = (
  authorizationSession: AuthorizationSession,
  mode: OpenIdPromptMode,
): boolean => !authorizationSession.promptModes.includes(mode);
