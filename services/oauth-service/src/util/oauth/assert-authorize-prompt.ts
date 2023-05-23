import { OpenIdPromptMode } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationRequest } from "../../entity";

type Options = {
  consentRequired: boolean;
  loginRequired: boolean;
  selectAccountRequired: boolean;
};

export const assertAuthorizePrompt = (
  authorizationRequest: AuthorizationRequest,
  options: Options,
): void => {
  const { promptModes } = authorizationRequest;
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
      code: "account_selection_required",
      description: "The used prompt cannot be honored",
    });
  }
};
