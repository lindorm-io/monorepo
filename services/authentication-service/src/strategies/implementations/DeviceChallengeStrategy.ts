import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { configuration } from "../../server/configuration";
import { createStrategySessionToken } from "../../handler";
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
} from "@lindorm-io/common-types";

export class DeviceChallengeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 3,
    loaMax: 3,
    method: AuthenticationMethod.DEVICE_LINK,
    methodsMax: 0,
    methodsMin: 0,
    mfaCookie: false,
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
      confirmKey: AuthenticationStrategyConfirmKey.CHALLENGE_CONFIRMATION_TOKEN,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
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

    const verifiedToken = jwt.verify(challengeConfirmationToken, {
      issuer:
        configuration.services.device_service.issuer || configuration.services.device_service.host,
      nonce: strategySession.nonce,
      scopes: ["authentication"],
      subject: authenticationSession.identityId,
      types: [DeviceTokenType.CHALLENGE_CONFIRMATION],
    });

    logger.debug("Resolving Account");

    return await accountRepository.find({ id: verifiedToken.subject });
  }
}
