import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { getRdcBody } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { configuration } from "../../server/configuration";
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

export class RdcQrCodeStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
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
  }

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      axios: { deviceClient },
    } = ctx;

    const body: InitialiseRdcSessionRequestBody = {
      ...getRdcBody(
        authenticationSession,
        strategySession,
        this.sessionToken(ctx, strategySession),
      ),
      mode: RdcSessionMode.QR_CODE,
    };

    await deviceClient.post("/admin/rdc", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expiresIn: this.expiresIn(strategySession),
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
