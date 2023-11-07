import {
  AuthStrategyConfig,
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  DeviceTokenType,
  InitialiseRdcSessionRequestBody,
  RdcSessionMode,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { getRdcBody } from "../../handler";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class RdcPushNotificationStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.PHISHING_RESISTANT,
    hintType: "none",
    identifierType: "none",
    loa: 3,
    loaMax: 3,
    method: AuthenticationMethod.DEVICE_LINK,
    mfaCookie: true,
    primary: false,
    requiresIdentity: true,
    secondary: true,
    strategy: AuthenticationStrategy.RDC_PUSH_NOTIFICATION,
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

    if (!authenticationSession.identityId) {
      throw new ClientError("Invalid identifier", {
        description: "Identity ID not found",
      });
    }

    await deviceClient.post<never, InitialiseRdcSessionRequestBody>("/admin/rdc", {
      body: {
        ...getRdcBody(ctx, authenticationSession, strategySession),
        mode: RdcSessionMode.PUSH_NOTIFICATION,
      },
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.CHALLENGE_CONFIRMATION_TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: null,
      visualHint: strategySession.visualHint,
    };
  }

  public async acknowledge(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: AcknowledgeStrategyOptions,
  ): Promise<AcknowledgeStrategyResult> {
    throw new ServerError("Strategy does not support this method");
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
      mongo: { accountRepository },
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

    const {
      claims: { subject },
    } = jwt.verify(challengeConfirmationToken, {
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
