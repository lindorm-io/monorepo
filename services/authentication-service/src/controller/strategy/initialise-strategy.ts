import Joi from "joi";
import { AuthenticationStrategy } from "../../enum";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ConfirmKey, ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_AUTHENTICATION_STRATEGY } from "../../constant";
import { StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { findStrategyConfig } from "../../util";
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
  initialiseRdcPushNotification,
  initialiseRdcQrCode,
  initialiseSessionAcceptWithCode,
  initialiseSessionOtp,
  initialiseWebauthn,
} from "../../handler";

type RequestData = {
  id: string;
  email?: string;
  nin?: string;
  nonce?: string;
  phoneNumber?: string;
  strategy: AuthenticationStrategy;
  username?: string;
};

type ResponseBody = {
  id: string;
  displayCode?: string;
  confirmKey: ConfirmKey;
  expiresIn: number;
  pollingRequired: boolean;
  qrCode?: string;
  strategySessionToken: string | null;
};

export const initialiseStrategySchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    email: JOI_EMAIL.optional(),
    nin: JOI_NIN.optional(),
    nonce: Joi.string().optional(),
    phoneNumber: JOI_PHONE_NUMBER.optional(),
    strategy: JOI_AUTHENTICATION_STRATEGY.required(),
    username: Joi.string().optional(),
  })
  .required();

export const initialiseStrategyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { strategySessionCache },
    data: { email, nin, nonce, phoneNumber, strategy, username },
    entity: { authenticationSession },
    jwt,
  } = ctx;

  const config = findStrategyConfig(strategy);

  if (!authenticationSession.allowedStrategies.includes(strategy)) {
    throw new ClientError("Invalid strategy");
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
      strategy,
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

  switch (strategy) {
    case AuthenticationStrategy.DEVICE_CHALLENGE:
    case AuthenticationStrategy.MFA_COOKIE:
    case AuthenticationStrategy.PASSWORD:
    case AuthenticationStrategy.PASSWORD_BROWSER_LINK:
    case AuthenticationStrategy.TIME_BASED_OTP:
      break;

    case AuthenticationStrategy.BANK_ID_SE:
      await initialiseBankIdSe(ctx, authenticationSession, strategySession);
      break;

    case AuthenticationStrategy.EMAIL_LINK:
      await initialiseEmailLink(ctx, strategySession, {
        strategySessionToken,
        email,
      });
      break;

    case AuthenticationStrategy.EMAIL_OTP:
      await initialiseEmailOtp(ctx, strategySession, {
        email,
      });
      break;

    case AuthenticationStrategy.PHONE_OTP:
      await initialisePhoneOtp(ctx, authenticationSession, strategySession, {
        phoneNumber,
      });
      break;

    case AuthenticationStrategy.RDC_PUSH_NOTIFICATION:
      await initialiseRdcPushNotification(ctx, authenticationSession, strategySession, {
        strategySessionToken,
      });
      break;

    case AuthenticationStrategy.RDC_QR_CODE:
      extra = await initialiseRdcQrCode(ctx, authenticationSession, strategySession, {
        strategySessionToken,
      });
      break;

    case AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE:
      extra = await initialiseSessionAcceptWithCode(ctx, authenticationSession, strategySession, {
        strategySessionToken,
      });
      break;

    case AuthenticationStrategy.SESSION_OTP:
      await initialiseSessionOtp(ctx, authenticationSession, strategySession);
      break;

    case AuthenticationStrategy.WEBAUTHN:
      await initialiseWebauthn(ctx, authenticationSession, strategySession);
      break;

    default:
      throw new ServerError("Unknown Strategy");
  }

  return {
    body: {
      id: strategySession.id,
      confirmKey: config.confirmKey,
      strategySessionToken: config.tokenReturn ? strategySessionToken : null,
      expiresIn,
      pollingRequired: config.pollingRequired,
      ...extra,
    },
  };
};
