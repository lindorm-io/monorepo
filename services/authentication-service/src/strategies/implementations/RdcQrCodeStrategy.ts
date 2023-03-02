import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { getRdcBody } from "../../handler";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  DeviceTokenType,
  InitialiseRdcSessionRequestBody,
  RdcSessionMode,
} from "@lindorm-io/common-types";

export class RdcQrCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 3,
    loaMax: 3,
    method: AuthenticationMethod.DEVICE_LINK,
    methodsMax: 9,
    methodsMin: 0,
    mfaCookie: true,
    strategy: AuthenticationStrategy.RDC_QR_CODE,
    weight: 90,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      axios: { deviceClient },
    } = ctx;

    await deviceClient.post<never, InitialiseRdcSessionRequestBody>("/admin/rdc", {
      body: {
        ...getRdcBody(ctx, authenticationSession, strategySession),
        mode: RdcSessionMode.QR_CODE,
      },
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.CHALLENGE_CONFIRMATION_TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: "QR_CODE",
      strategySessionToken: null,
      visualHint: null,
    };
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      jwt,
      logger,
      repository: { accountRepository },
    } = ctx;

    const { challengeConfirmationToken } = options;

    if (!challengeConfirmationToken) {
      throw new ClientError("Invalid input", {
        data: { challengeConfirmationToken },
      });
    }

    logger.debug("Verifying Challenge Confirmation Token");

    if (!strategySession.nonce) {
      throw new ServerError("Invalid strategySession", {
        debug: { nonce: strategySession.nonce },
      });
    }

    const { subject } = jwt.verify(challengeConfirmationToken, {
      audience: configuration.oauth.client_id,
      issuer: configuration.services.device_service.issuer,
      nonce: strategySession.nonce,
      scopes: ["authentication"],
      types: [DeviceTokenType.CHALLENGE_CONFIRMATION],
    });

    logger.debug("Resolving Account");

    return await accountRepository.find({ id: subject });
  }
}
