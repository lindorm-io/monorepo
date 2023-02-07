import Joi from "joi";
import { Account } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus } from "../../util";
import { flatten, uniq } from "lodash";
import { removeEmptyFromArray } from "@lindorm-io/core";
import {
  AuthenticationStrategies,
  ConfirmStrategyRequestBody,
  ConfirmStrategyRequestParams,
  SessionStatuses,
} from "@lindorm-io/common-types";
import {
  confirmBankIdSe,
  confirmDeviceChallenge,
  confirmEmailLink,
  confirmEmailOtp,
  confirmMfaCookie,
  confirmPassword,
  confirmPasswordBrowserLink,
  confirmPhoneOtp,
  confirmRdcPushNotification,
  confirmRdcQrCode,
  confirmSessionAcceptWithCode,
  confirmSessionOtp,
  confirmTimeBasedOtp,
  confirmWebauthn,
  resolveAllowedStrategies,
} from "../../handler";

type RequestData = ConfirmStrategyRequestParams & ConfirmStrategyRequestBody;

export const confirmStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    challengeConfirmationToken: JOI_JWT.optional(),
    code: Joi.string().optional(),
    otp: Joi.string().optional(),
    password: Joi.string().optional(),
    rdcSessionId: Joi.string().optional(),
    rdcSessionStatus: Joi.string().optional(),
    remember: Joi.boolean().optional(),
    strategySessionToken: JOI_JWT.required(),
    totp: Joi.string().optional(),
  })
  .required();

export const confirmStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { authenticationSessionCache, strategySessionCache },
    data: { challengeConfirmationToken, code, otp, password, remember, totp },
    entity: { authenticationSession, strategySession },
  } = ctx;

  const { status, strategy } = strategySession;

  if (status !== SessionStatuses.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  let account: Account;

  switch (strategy) {
    case AuthenticationStrategies.BANK_ID_SE:
      account = await confirmBankIdSe(ctx, authenticationSession, strategySession, {
        data: null,
      });
      break;

    case AuthenticationStrategies.DEVICE_CHALLENGE:
      account = await confirmDeviceChallenge(ctx, authenticationSession, strategySession, {
        challengeConfirmationToken,
      });
      break;

    case AuthenticationStrategies.EMAIL_LINK:
      account = await confirmEmailLink(ctx, authenticationSession, strategySession, {
        code,
      });
      break;

    case AuthenticationStrategies.EMAIL_OTP:
      account = await confirmEmailOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationStrategies.MFA_COOKIE:
      account = await confirmMfaCookie(ctx, authenticationSession);
      break;

    case AuthenticationStrategies.PASSWORD:
      account = await confirmPassword(ctx, authenticationSession, strategySession, {
        password,
      });
      break;

    case AuthenticationStrategies.PASSWORD_BROWSER_LINK:
      account = await confirmPasswordBrowserLink(ctx, authenticationSession, strategySession, {
        password,
      });
      break;

    case AuthenticationStrategies.PHONE_OTP:
      account = await confirmPhoneOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationStrategies.RDC_PUSH_NOTIFICATION:
      account = await confirmRdcPushNotification(ctx, strategySession, {
        challengeConfirmationToken,
      });
      break;

    case AuthenticationStrategies.RDC_QR_CODE:
      account = await confirmRdcQrCode(ctx, strategySession, {
        challengeConfirmationToken,
      });
      break;

    case AuthenticationStrategies.SESSION_ACCEPT_WITH_CODE:
      account = await confirmSessionAcceptWithCode(ctx, authenticationSession, strategySession, {
        code,
      });
      break;

    case AuthenticationStrategies.SESSION_OTP:
      account = await confirmSessionOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationStrategies.TIME_BASED_OTP:
      account = await confirmTimeBasedOtp(ctx, authenticationSession, {
        totp,
      });
      break;

    case AuthenticationStrategies.WEBAUTHN:
      account = await confirmWebauthn(ctx, authenticationSession, strategySession, {
        data: null,
      });
      break;

    default:
      throw new ServerError("Unknown Strategy");
  }

  if (authenticationSession.identityId && authenticationSession.identityId !== account.id) {
    throw new ClientError("Invalid Identity", {
      description: "Identity ID mismatch",
      debug: {
        expect: authenticationSession.identityId,
        actual: account.id,
      },
    });
  }

  authenticationSession.confirmedStrategies.push(strategy);
  authenticationSession.confirmedIdentifiers = removeEmptyFromArray(
    uniq(
      flatten([
        authenticationSession.confirmedIdentifiers,
        strategySession.email,
        strategySession.nin,
        strategySession.phoneNumber,
        strategySession.username,
      ]),
    ),
  );
  authenticationSession.identityId = account.id;

  authenticationSession.remember = remember === true;
  authenticationSession.status = calculateAuthenticationStatus(authenticationSession);

  if (authenticationSession.status === SessionStatuses.PENDING) {
    authenticationSession.allowedStrategies = await resolveAllowedStrategies(
      ctx,
      authenticationSession,
      account,
    );
  }

  await authenticationSessionCache.update(authenticationSession);

  strategySession.status = SessionStatuses.CONFIRMED;

  await strategySessionCache.update(strategySession);
};
