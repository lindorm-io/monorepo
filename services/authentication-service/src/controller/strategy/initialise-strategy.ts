import Joi from "joi";
import { AuthenticationMethod } from "../../enum";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_AUTHENTICATION_METHOD } from "../../constant";
import { ServerKoaController } from "../../types";
import { StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { findMethodConfiguration } from "../../util";
import { getExpires } from "@lindorm-io/core";
import {
  JOI_EMAIL,
  JOI_GUID,
  JOI_NIN,
  JOI_PHONE_NUMBER,
  SubjectHint,
  TokenType,
} from "../../common";
import {
  initialiseBankIdSe,
  initialiseEmailLink,
  initialiseEmailOtp,
  initialisePhoneOtp,
  initialiseRdcQrCode,
  initialiseSessionAcceptWithCode,
  initialiseSessionOtp,
  initialiseWebauthn,
} from "../../handler";

interface RequestData {
  id: string;
  email?: string;
  nin?: string;
  nonce?: string;
  phoneNumber?: string;
  method: AuthenticationMethod;
  username?: string;
}

interface ResponseBody {
  id: string;
  expiresIn: number;
  pollingRequired: boolean;
  strategySessionToken: string | null;

  displayCode?: string;
  qrCode?: string;
}

export const initialiseStrategySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    email: JOI_EMAIL.optional(),
    nin: JOI_NIN.optional(),
    nonce: Joi.string().optional(),
    phoneNumber: JOI_PHONE_NUMBER.optional(),
    method: JOI_AUTHENTICATION_METHOD.required(),
    username: Joi.string().optional(),
  })
  .required();

export const initialiseStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { strategySessionCache },
    data: { email, nin, nonce, phoneNumber, method, username },
    entity: { authenticationSession },
    jwt,
  } = ctx;

  const config = findMethodConfiguration(method);

  if (!authenticationSession.allowedMethods.includes(method)) {
    throw new ClientError("Invalid method");
  }

  const { expiresIn } = getExpires(authenticationSession.expires);

  const strategySession = await strategySessionCache.create(
    new StrategySession({
      authenticationSessionId: authenticationSession.id,
      email,
      expires: authenticationSession.expires,
      nin,
      nonce,
      phoneNumber,
      method,
      username,
    }),
  );

  const { token: strategySessionToken } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: strategySession.expires,
    subject: strategySession.id,
    subjectHint: SubjectHint.SESSION,
    type: TokenType.STRATEGY_SESSION,
  });

  let extra: {
    displayCode?: string;
    qrCode?: string;
  } = {};

  switch (method) {
    case AuthenticationMethod.DEVICE_CHALLENGE:
    case AuthenticationMethod.MFA_COOKIE:
    case AuthenticationMethod.PASSWORD:
    case AuthenticationMethod.PASSWORD_BROWSER_LINK:
    case AuthenticationMethod.TIME_BASED_OTP:
      break;

    case AuthenticationMethod.BANK_ID_SE:
      await initialiseBankIdSe(ctx, authenticationSession, strategySession);
      break;

    case AuthenticationMethod.EMAIL_LINK:
      await initialiseEmailLink(ctx, strategySession, {
        strategySessionToken,
        email,
      });
      break;

    case AuthenticationMethod.EMAIL_OTP:
      await initialiseEmailOtp(ctx, strategySession, {
        email,
      });
      break;

    case AuthenticationMethod.PHONE_OTP:
      await initialisePhoneOtp(ctx, authenticationSession, strategySession, {
        phoneNumber,
      });
      break;

    case AuthenticationMethod.RDC_QR_CODE:
      extra = await initialiseRdcQrCode(ctx, authenticationSession, strategySession, {
        strategySessionToken,
      });
      break;

    case AuthenticationMethod.SESSION_ACCEPT_WITH_CODE:
      extra = await initialiseSessionAcceptWithCode(ctx, authenticationSession, strategySession, {
        strategySessionToken,
      });
      break;

    case AuthenticationMethod.SESSION_OTP:
      await initialiseSessionOtp(ctx, authenticationSession, strategySession);
      break;

    case AuthenticationMethod.WEBAUTHN:
      await initialiseWebauthn(ctx, authenticationSession, strategySession);
      break;

    default:
      throw new ServerError("Unknown Strategy");
  }

  return {
    body: {
      id: strategySession.id,
      strategySessionToken: config.tokenReturn ? strategySessionToken : null,
      expiresIn,
      pollingRequired: config.pollingRequired,
      ...extra,
    },
  };
};
