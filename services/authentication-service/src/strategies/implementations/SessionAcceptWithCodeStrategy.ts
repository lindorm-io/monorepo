import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { createStrategySessionToken, getValidIdentitySessions } from "../../handler";
import { randomString } from "@lindorm-io/random";
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
  EmitSocketEventRequestBody,
} from "@lindorm-io/common-types";

export class SessionAcceptWithCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "none",
    identifierType: "none",
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.SESSION_LINK,
    methodsMax: 1,
    methodsMin: 0,
    mfaCookie: false,
    strategy: AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE,
    weight: 80,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      axios: { communicationClient },
      cache: { strategySessionCache },
    } = ctx;

    if (!authenticationSession.identityId) {
      throw new ClientError("Invalid identifier", {
        description: "Identity ID not found",
      });
    }

    const confirmLength = 8;
    const displayCode = randomString(confirmLength).toUpperCase();

    strategySession.secret = await argon.encrypt(displayCode);

    await strategySessionCache.update(strategySession);

    const sessions = await getValidIdentitySessions(ctx, authenticationSession.identityId);

    if (!sessions.length) {
      throw new ServerError("Bad Request", {
        description: "Unable to find sessions",
      });
    }

    const strategySessionToken = createStrategySessionToken(ctx, strategySession);

    const body: EmitSocketEventRequestBody = {
      channels: { sessions },
      content: {
        id: authenticationSession.id,
        strategySessionToken,
        visualHint: strategySession.visualHint,
      },
      event: "authentication-service:session-accept-with-code",
    };

    await communicationClient.post("/admin/socket/emit", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength,
      confirmMode: AuthenticationStrategyConfirmMode.TEXT,
      displayCode,
      expires: strategySession.expires.toISOString(),
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
      logger,
      repository: { accountRepository },
    } = ctx;

    const { code } = options;

    if (!code) {
      throw new ClientError("Invalid input", {
        data: { code },
      });
    }

    logger.debug("Verifying Code");

    if (!strategySession.secret) {
      throw new ServerError("Invalid strategySession", {
        debug: { code: strategySession.secret },
      });
    }

    await argon.assert(code, strategySession.secret);

    logger.debug("Resolving Account");

    if (!authenticationSession.identityId) {
      throw new ServerError("Invalid authenticationSession", {
        debug: { identityId: authenticationSession.identityId },
      });
    }

    return await accountRepository.find({ id: authenticationSession.identityId });
  }
}
