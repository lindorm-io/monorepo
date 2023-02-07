import Joi from "joi";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_AUTHENTICATION_STRATEGY } from "../../constant";
import { StrategySession } from "../../entity";
import { configuration } from "../../server/configuration";
import { expiryObject } from "@lindorm-io/expiry";
import { findStrategyConfig } from "../../util";
import { JOI_EMAIL, JOI_NIN, JOI_PHONE_NUMBER } from "../../common";
import { ServerKoaController } from "../../types";
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
import {
  AuthenticationStrategies,
  AuthStrategyDefaultConfig,
  AuthStrategyInitialisation,
  InitialiseStrategyRequestBody,
  InitialiseStrategyRequestParams,
  InitialiseStrategyResponse,
  LindormTokenTypes,
  SubjectHints,
} from "@lindorm-io/common-types";

type RequestData = InitialiseStrategyRequestParams & InitialiseStrategyRequestBody;

type ResponseBody = InitialiseStrategyResponse;

export const initialiseStrategySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
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

  const { expiresIn } = expiryObject(authenticationSession.expires);

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
    subjectHint: SubjectHints.SESSION,
    type: LindormTokenTypes.STRATEGY_SESSION,
  });

  const strategyConfig: AuthStrategyDefaultConfig = {
    id: strategySession.id,
    expiresIn,
    inputKey: config.confirmKey,
    inputLength: config.confirmLength,
    inputMode: config.confirmMode,
    pollingRequired: config.pollingRequired,
    strategySessionToken: config.tokenReturn ? strategySessionToken : null,
  };

  let strategyInitialisation: AuthStrategyInitialisation = {
    displayCode: null,
    qrCode: null,
  };

  switch (strategy) {
    case AuthenticationStrategies.DEVICE_CHALLENGE:
    case AuthenticationStrategies.MFA_COOKIE:
    case AuthenticationStrategies.PASSWORD:
    case AuthenticationStrategies.PASSWORD_BROWSER_LINK:
    case AuthenticationStrategies.TIME_BASED_OTP:
      break;

    case AuthenticationStrategies.BANK_ID_SE:
      await initialiseBankIdSe(ctx, authenticationSession, strategySession);
      break;

    case AuthenticationStrategies.EMAIL_LINK:
      await initialiseEmailLink(ctx, strategySession, {
        strategySessionToken,
        email,
      });
      break;

    case AuthenticationStrategies.EMAIL_OTP:
      await initialiseEmailOtp(ctx, strategySession, config, {
        email,
      });
      break;

    case AuthenticationStrategies.PHONE_OTP:
      await initialisePhoneOtp(ctx, authenticationSession, strategySession, config, {
        phoneNumber,
      });
      break;

    case AuthenticationStrategies.RDC_PUSH_NOTIFICATION:
      await initialiseRdcPushNotification(ctx, authenticationSession, strategySession, config, {
        strategySessionToken,
      });
      break;

    case AuthenticationStrategies.RDC_QR_CODE:
      strategyInitialisation = await initialiseRdcQrCode(
        ctx,
        authenticationSession,
        strategySession,
        {
          strategySessionToken,
        },
      );
      break;

    case AuthenticationStrategies.SESSION_ACCEPT_WITH_CODE:
      strategyInitialisation = await initialiseSessionAcceptWithCode(
        ctx,
        authenticationSession,
        strategySession,
        config,
        { strategySessionToken },
      );
      break;

    case AuthenticationStrategies.SESSION_OTP:
      await initialiseSessionOtp(ctx, authenticationSession, strategySession, config);
      break;

    case AuthenticationStrategies.WEBAUTHN:
      await initialiseWebauthn(ctx, authenticationSession, strategySession);
      break;

    default:
      throw new ServerError("Unknown Strategy");
  }

  return {
    body: { ...strategyConfig, ...strategyInitialisation },
  };
};
