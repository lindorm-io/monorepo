import Joi from "joi";
import { Account } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { FlowType } from "../../enum";
import { JOI_GUID, JOI_JWT, SessionStatus } from "../../common";
import { canFlowGenerateMfaCookie } from "../../util";
import {
  confirmBankIdSeFlow,
  confirmDeviceChallengeFlow,
  confirmEmailLinkFlow,
  confirmEmailOtpFlow,
  confirmMfaCookieFlow,
  confirmPasswordBrowserLinkFlow,
  confirmPasswordFlow,
  confirmPhoneOtpFlow,
  confirmRdcQrCodeFlow,
  confirmSessionAcceptWithCodeFlow,
  confirmSessionOtpFlow,
  confirmTimeBasedOtpFlow,
  confirmWebauthnFlow,
  generateMfaCookie,
  updateLoginSessionWithFlow,
} from "../../handler";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  code: string;
  flowToken: string;
  otp: string;
  password: string;
  rdcSessionId: never;
  rdcSessionStatus: never;
  totp: string;
}

export const confirmFlowSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  challengeConfirmationToken: JOI_JWT.optional(),
  code: Joi.string().optional(),
  flowToken: JOI_JWT.required(),
  otp: Joi.string().optional(),
  password: Joi.string().optional(),
  rdcSessionId: Joi.string().optional(),
  rdcSessionStatus: Joi.string().optional(),
  totp: Joi.string().optional(),
});

export const confirmFlowController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { flowSessionCache },
    data: { challengeConfirmationToken, code, otp, password, totp },
    entity: { flowSession },
  } = ctx;

  let account: Account;
  let loginSession = ctx.entity.loginSession;

  switch (flowSession.type) {
    case FlowType.BANK_ID_SE:
      account = await confirmBankIdSeFlow(ctx, loginSession, flowSession, { data: null });
      break;

    case FlowType.DEVICE_CHALLENGE:
      account = await confirmDeviceChallengeFlow(ctx, loginSession, flowSession, {
        challengeConfirmationToken,
      });
      break;

    case FlowType.EMAIL_LINK:
      account = await confirmEmailLinkFlow(ctx, loginSession, flowSession, {
        code,
      });
      break;

    case FlowType.EMAIL_OTP:
      account = await confirmEmailOtpFlow(ctx, loginSession, flowSession, {
        otp,
      });
      break;

    case FlowType.MFA_COOKIE:
      account = await confirmMfaCookieFlow(ctx, loginSession, flowSession);
      break;

    case FlowType.PASSWORD:
      account = await confirmPasswordFlow(ctx, loginSession, flowSession, {
        password,
      });
      break;

    case FlowType.PASSWORD_BROWSER_LINK:
      account = await confirmPasswordBrowserLinkFlow(ctx, loginSession, flowSession, {
        password,
      });
      break;

    case FlowType.PHONE_OTP:
      account = await confirmPhoneOtpFlow(ctx, loginSession, flowSession, {
        otp,
      });
      break;

    case FlowType.RDC_QR_CODE:
      account = await confirmRdcQrCodeFlow(ctx, loginSession, flowSession, {
        challengeConfirmationToken,
      });
      break;

    case FlowType.SESSION_ACCEPT_WITH_CODE:
      account = await confirmSessionAcceptWithCodeFlow(ctx, loginSession, flowSession, {
        code,
      });
      break;

    case FlowType.SESSION_OTP:
      account = await confirmSessionOtpFlow(ctx, loginSession, flowSession, {
        otp,
      });
      break;

    case FlowType.TIME_BASED_OTP:
      account = await confirmTimeBasedOtpFlow(ctx, loginSession, flowSession, {
        totp,
      });
      break;

    case FlowType.WEBAUTHN:
      account = await confirmWebauthnFlow(ctx, loginSession, flowSession, { data: null });
      break;

    default:
      throw new ServerError("Unknown Flow");
  }

  if (loginSession.identityId && loginSession.identityId !== account.id) {
    throw new ClientError("Invalid Identity", {
      description: "Identity ID mismatch",
      debug: {
        expect: loginSession.identityId,
        actual: account.id,
      },
    });
  }

  flowSession.status = SessionStatus.CONFIRMED;

  await flowSessionCache.update(flowSession);

  loginSession = await updateLoginSessionWithFlow(ctx, account, loginSession, flowSession);

  if (canFlowGenerateMfaCookie(loginSession, flowSession.type)) {
    await generateMfaCookie(ctx, account);
  }
};
