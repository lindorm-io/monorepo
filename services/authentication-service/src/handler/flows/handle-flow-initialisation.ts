import { LoginSession, FlowSession } from "../../entity";
import { FlowType, TokenType } from "../../enum";
import { ServerError } from "@lindorm-io/errors";
import { SubjectHint } from "../../common";
import { configuration } from "../../server/configuration";
import { getExpires } from "@lindorm-io/core";
import { isPollingRequired, isTokenReturned } from "../../util";
import {
  ServerKoaContext,
  InitialiseFlowRequestData,
  InitialiseFlowResponseBody,
} from "../../types";
import {
  initialiseBankIdSeFlow,
  initialiseEmailLinkFlow,
  initialiseEmailOtpFlow,
  initialisePhoneOtpFlow,
  initialiseRdcQrCodeFlow,
  initialiseSessionAcceptWithCodeFlow,
  initialiseSessionOtpFlow,
  initialiseWebauthnFlow,
} from "../../handler";

export const handleFlowInitialisation = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  options: InitialiseFlowRequestData,
): Promise<InitialiseFlowResponseBody> => {
  const {
    cache: { flowSessionCache },
    jwt,
    logger,
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
    case FlowType.DEVICE_CHALLENGE:
    case FlowType.MFA_COOKIE:
    case FlowType.PASSWORD:
    case FlowType.PASSWORD_BROWSER_LINK:
    case FlowType.TIME_BASED_OTP:
      break;

    case FlowType.BANK_ID_SE:
      await initialiseBankIdSeFlow(ctx, loginSession, flowSession);
      break;

    case FlowType.EMAIL_LINK:
      await initialiseEmailLinkFlow(ctx, loginSession, flowSession, {
        flowToken,
        email,
      });
      break;

    case FlowType.EMAIL_OTP:
      await initialiseEmailOtpFlow(ctx, loginSession, flowSession, { email });
      break;

    case FlowType.PHONE_OTP:
      await initialisePhoneOtpFlow(ctx, loginSession, flowSession, { phoneNumber });
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
      await initialiseSessionOtpFlow(ctx, loginSession, flowSession);
      break;

    case FlowType.WEBAUTHN:
      await initialiseWebauthnFlow(ctx, loginSession, flowSession);
      break;

    default:
      throw new ServerError("Unknown Flow");
  }

  logger.info("Flow initialised", {
    id: flowSession.id,
    loginSessionId: loginSession.id,
    type: flowSession.type,
    flowToken,
  });

  return {
    id: flowSession.id,
    pollingRequired: isPollingRequired(flowType),
    ...(isTokenReturned(flowType) ? { flowToken } : {}),
    ...(extra ? { ...extra } : {}),
  };
};
