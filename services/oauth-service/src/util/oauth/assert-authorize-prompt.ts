import { AuthorizationSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { PromptMode } from "../../common";

interface Options {
  isConsentRequired: boolean;
  isAuthenticationRequired: boolean;
}

export const assertAuthorizePrompt = (
  authorizationSession: AuthorizationSession,
  options: Options,
): void => {
  const { promptModes } = authorizationSession;
  const { isConsentRequired, isAuthenticationRequired } = options;

  if (isAuthenticationRequired && promptModes.includes(PromptMode.NONE)) {
    throw new ClientError("Login Required", {
      code: "login_required",
      description: "interaction_required",
    });
  }

  if (isConsentRequired && promptModes.includes(PromptMode.NONE)) {
    throw new ClientError("Consent Required", {
      code: "consent_required",
      description: "interaction_required",
    });
  }
};
