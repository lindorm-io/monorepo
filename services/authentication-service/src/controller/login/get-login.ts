import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { FlowType } from "../../enum";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { SessionStatus } from "../../common";
import { oauthConfirmAuthentication, getCurrentFlowSession } from "../../handler";
import { getPrioritizedFlow, isAuthenticationReadyToConfirm, isPollingRequired } from "../../util";

interface ResponseBody {
  availableFlows: Array<FlowType>;
  availableOidc: Array<string>;
  currentFlow?: {
    id: string;
    pollingRequired: boolean;
    flowType: FlowType;
    status: SessionStatus;
  };
  loginHint: Array<string>;
  prioritizedFlow: FlowType;
  remember: boolean;
  requestedMethods: Array<string>;
}

export const getLoginController: Controller<Context> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { loginSession },
  } = ctx;

  if (isAuthenticationReadyToConfirm(loginSession)) {
    const { redirectTo } = await oauthConfirmAuthentication(ctx, loginSession);

    ctx.deleteCookie(LOGIN_SESSION_COOKIE_NAME);

    return { redirect: redirectTo };
  }

  const flowSession = await getCurrentFlowSession(ctx, loginSession);

  return {
    body: {
      availableFlows: loginSession.allowedFlows,
      availableOidc: loginSession.allowedOidc,
      ...(flowSession
        ? {
            currentFlow: {
              id: flowSession.id,
              pollingRequired: isPollingRequired(flowSession.type),
              flowType: flowSession.type,
              status: flowSession.status,
            },
          }
        : {}),
      loginHint: loginSession.loginHint,
      prioritizedFlow: getPrioritizedFlow(loginSession),
      remember: loginSession.remember,
      requestedMethods: loginSession.requestedAuthenticationMethods,
    },
  };
};
