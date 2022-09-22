import { AuthorizationSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { PromptMode } from "../../common";

interface Options {
  consentRequired: boolean;
  loginRequired: boolean;
}

export const assertAuthorizePrompt = (
  authorizationSession: AuthorizationSession,
  options: Options,
): void => {
  const { promptModes } = authorizationSession;
  const { consentRequired, loginRequired } = options;

  if (consentRequired && promptModes.includes(PromptMode.NONE)) {
    throw new ClientError("Login Required", {
      code: "login_required",
      description: "interaction_required",
    });
  }

  if (loginRequired && promptModes.includes(PromptMode.NONE)) {
    throw new ClientError("Consent Required", {
      code: "consent_required",
      description: "interaction_required",
    });
  }
};
