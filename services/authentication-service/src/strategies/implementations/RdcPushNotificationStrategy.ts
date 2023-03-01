import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { getRdcBody } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
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

export class RdcPushNotificationStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "none",
      identifierType: "none",
      loa: 3,
      loaMax: 3,
      method: AuthenticationMethod.DEVICE_LINK,
      methodsMax: 9,
      methodsMin: 1,
      mfaCookie: true,
      strategy: AuthenticationStrategy.RDC_PUSH_NOTIFICATION,
      weight: 90,
    };
  }

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      axios: { deviceClient, oauthClient },
      cache: { strategySessionCache },
    } = ctx;

    if (!authenticationSession.identityId) {
      throw new ClientError("Invalid identifier", {
        description: "Identity ID not found",
      });
    }

    await strategySessionCache.update(strategySession);

    const body: InitialiseRdcSessionRequestBody = {
      ...getRdcBody(
        authenticationSession,
        strategySession,
        this.sessionToken(ctx, strategySession),
      ),
      mode: RdcSessionMode.PUSH_NOTIFICATION,
    };

    await deviceClient.post("/admin/rdc", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expiresIn: this.expiresIn(strategySession),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: null,
      visualHint: strategySession.visualHint,
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
