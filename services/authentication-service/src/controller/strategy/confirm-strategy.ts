import Joi from "joi";
import { Account } from "../../entity";
import { AuthenticationMethod } from "../../enum";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, SessionStatus } from "../../common";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus, calculateLevelOfAssurance } from "../../util";
import {
  confirmBankIdSe,
  confirmDeviceChallenge,
  confirmEmailLink,
  confirmEmailOtp,
  confirmMfaCookie,
  confirmPassword,
  confirmPasswordBrowserLink,
  confirmPhoneOtp,
  confirmRdcQrCode,
  confirmSessionAcceptWithCode,
  confirmSessionOtp,
  confirmTimeBasedOtp,
  confirmWebauthn,
  resolveAllowedMethods,
} from "../../handler";
import { flatten, uniq } from "lodash";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  code: string;
  otp: string;
  password: string;
  rdcSessionId: never;
  rdcSessionStatus: never;
  remember: boolean;
  strategySessionToken: string;
  totp: string;
}

export const confirmStrategySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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

  if (strategySession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  let account: Account;

  switch (strategySession.method) {
    case AuthenticationMethod.BANK_ID_SE:
      account = await confirmBankIdSe(ctx, authenticationSession, strategySession, {
        data: null,
      });
      break;

    case AuthenticationMethod.DEVICE_CHALLENGE:
      account = await confirmDeviceChallenge(ctx, authenticationSession, strategySession, {
        challengeConfirmationToken,
      });
      break;

    case AuthenticationMethod.EMAIL_LINK:
      account = await confirmEmailLink(ctx, authenticationSession, strategySession, {
        code,
      });
      break;

    case AuthenticationMethod.EMAIL_OTP:
      account = await confirmEmailOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationMethod.MFA_COOKIE:
      account = await confirmMfaCookie(ctx, authenticationSession);
      break;

    case AuthenticationMethod.PASSWORD:
      account = await confirmPassword(ctx, authenticationSession, strategySession, {
        password,
      });
      break;

    case AuthenticationMethod.PASSWORD_BROWSER_LINK:
      account = await confirmPasswordBrowserLink(ctx, authenticationSession, strategySession, {
        password,
      });
      break;

    case AuthenticationMethod.PHONE_OTP:
      account = await confirmPhoneOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationMethod.RDC_QR_CODE:
      account = await confirmRdcQrCode(ctx, strategySession, {
        challengeConfirmationToken,
      });
      break;

    case AuthenticationMethod.SESSION_ACCEPT_WITH_CODE:
      account = await confirmSessionAcceptWithCode(ctx, authenticationSession, strategySession, {
        code,
      });
      break;

    case AuthenticationMethod.SESSION_OTP:
      account = await confirmSessionOtp(ctx, authenticationSession, strategySession, {
        otp,
      });
      break;

    case AuthenticationMethod.TIME_BASED_OTP:
      account = await confirmTimeBasedOtp(ctx, authenticationSession, {
        totp,
      });
      break;

    case AuthenticationMethod.WEBAUTHN:
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

  authenticationSession.identityId = account.id;
  authenticationSession.confirmedMethods.push(strategySession.method);

  authenticationSession.confirmedIdentifiers = uniq(
    flatten([
      authenticationSession.confirmedIdentifiers,
      [
        ...(strategySession.email ? [strategySession.email] : []),
        ...(strategySession.nin ? [strategySession.nin] : []),
        ...(strategySession.phoneNumber ? [strategySession.phoneNumber] : []),
        ...(strategySession.username ? [strategySession.username] : []),
      ],
    ]),
  );

  authenticationSession.confirmedLevelOfAssurance =
    calculateLevelOfAssurance(authenticationSession);

  authenticationSession.allowedMethods = await resolveAllowedMethods(
    ctx,
    authenticationSession,
    account,
  );

  authenticationSession.remember = remember;
  authenticationSession.status = calculateAuthenticationStatus(authenticationSession);

  await authenticationSessionCache.update(authenticationSession);

  strategySession.status = SessionStatus.CONFIRMED;

  await strategySessionCache.update(strategySession);
};
