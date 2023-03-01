import { AuthorizationSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { OpenIdPromptMode } from "@lindorm-io/common-types";

type Options = {
  consentRequired: boolean;
  loginRequired: boolean;
  selectAccountRequired: boolean;
};

export const assertAuthorizePrompt = (
  authorizationSession: AuthorizationSession,
  options: Options,
): void => {
  const { promptModes } = authorizationSession;
  const { consentRequired, loginRequired, selectAccountRequired } = options;

  if (consentRequired && promptModes.includes(OpenIdPromptMode.NONE)) {
    throw new ClientError("Login Required", {
      code: "login_required",
      description: "The used prompt cannot be honored",
    });
  }

  if (loginRequired && promptModes.includes(OpenIdPromptMode.NONE)) {
    throw new ClientError("Consent Required", {
      code: "consent_required",
      description: "The used prompt cannot be honored",
    });
  }

  if (selectAccountRequired && promptModes.includes(OpenIdPromptMode.NONE)) {
    throw new ClientError("Select Required", {
      code: "select_account_required",
      description: "The used prompt cannot be honored",
    });
  }
};
