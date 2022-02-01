import { LoginSession, FlowSession } from "../../entity";
import { FlowType, TokenType } from "../../enum";
import { ServerError } from "@lindorm-io/errors";
import { SubjectHint } from "../../common";
import { configuration } from "../../configuration";
import { getExpires } from "@lindorm-io/core";
import { isPollingRequired, isTokenReturned } from "../../util";
import { Context, InitialiseFlowRequestData, InitialiseFlowResponseBody } from "../../types";
import {
  initialiseBankIdSeFlow,
  initialiseDeviceChallengeFlow,
  initialiseEmailLinkFlow,
  initialiseEmailOtpFlow,
  initialiseMfaCookieFlow,
  initialisePasswordBrowserLinkFlow,
  initialisePasswordFlow,
  initialisePhoneOtpFlow,
  initialiseRdcQrCodeFlow,
  initialiseSessionAcceptWithCodeFlow,
  initialiseSessionOtpFlow,
  initialiseTimeBasedOtpFlow,
  initialiseWebauthnFlow,
} from "../../handler";

export const handleFlowInitialisation = async (
  ctx: Context,
  loginSession: LoginSession,
  options: InitialiseFlowRequestData,
): Promise<InitialiseFlowResponseBody> => {
  const {
    cache: { flowSessionCache },
    jwt,
  } = ctx;

  const { email, flowType, nonce, phoneNumber, username } = options;

  const { expiresIn } = getExpires(loginSession.expires);

  const flowSession = await flowSessionCache.create(
    new FlowSession({
      email,
      expires: loginSession.expires,
      loginSessionId: loginSession.id,
      nonce,
      phoneNumber,
      type: flowType,
      username,
    }),
    expiresIn,
  );

  const { token: flowToken } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: flowSession.expires,
    subject: flowSession.id,
    subjectHint: SubjectHint.SESSION,
    type: TokenType.FLOW_SESSION,
  });

  let extra: Record<string, any>;

  switch (flowType) {
    case FlowType.BANK_ID_SE:
      extra = await initialiseBankIdSeFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.DEVICE_CHALLENGE:
      await initialiseDeviceChallengeFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.EMAIL_LINK:
      await initialiseEmailLinkFlow(ctx, loginSession, flowSession, {
        flowToken,
        email,
      });
      break;

    case FlowType.EMAIL_OTP:
      await initialiseEmailOtpFlow(ctx, loginSession, flowSession, {
        flowToken,
        email,
      });
      break;

    case FlowType.MFA_COOKIE:
      await initialiseMfaCookieFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.PASSWORD:
      await initialisePasswordFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.PASSWORD_BROWSER_LINK:
      await initialisePasswordBrowserLinkFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.PHONE_OTP:
      await initialisePhoneOtpFlow(ctx, loginSession, flowSession, {
        flowToken,
        phoneNumber,
      });
      break;

    case FlowType.RDC_QR_CODE:
      extra = await initialiseRdcQrCodeFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.SESSION_ACCEPT_WITH_CODE:
      extra = await initialiseSessionAcceptWithCodeFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.SESSION_OTP:
      await initialiseSessionOtpFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.TIME_BASED_OTP:
      await initialiseTimeBasedOtpFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    case FlowType.WEBAUTHN:
      extra = await initialiseWebauthnFlow(ctx, loginSession, flowSession, {
        flowToken,
      });
      break;

    default:
      throw new ServerError("Unknown Flow");
  }

  return {
    id: flowSession.id,
    pollingRequired: isPollingRequired(flowType),
    ...(isTokenReturned(flowType) ? { flowToken } : {}),
    ...(extra ? { ...extra } : {}),
  };
};
