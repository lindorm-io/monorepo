import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  TokenType,
} from "@lindorm-io/common-enums";
import { AuthStrategyConfig } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { createStrategySessionToken } from "../../handler";
import { configuration } from "../../server/configuration";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class DeviceChallengeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
    hintType: "none",
    identifierType: "none",
    loa: 3,
    loaMax: 3,
    method: AuthenticationMethod.DEVICE_LINK,
    mfaCookie: false,
    primary: true,
    requiresIdentity: false,
    secondary: false,
    strategy: AuthenticationStrategy.DEVICE_CHALLENGE,
    weight: 90,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.CHALLENGE_CONFIRMATION_TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
      visualHint: null,
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

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authenticationSession", {
        debug: { identityId: authenticationSession.identityId },
      });
    }

    if (!strategySession.nonce) {
      throw new ServerError("Invalid strategySession", {
        debug: { nonce: strategySession.nonce },
      });
    }

    const { subject } = jwt.verify(challengeConfirmationToken, {
      issuer:
        configuration.services.device_service.issuer || configuration.services.device_service.host,
      nonce: strategySession.nonce,
      scopes: ["authentication"],
      subject: authenticationSession.identityId,
      types: [TokenType.CHALLENGE_CONFIRMATION],
    });

    logger.debug("Resolving Account");

    return await accountRepository.find({ id: subject });
  }
}
