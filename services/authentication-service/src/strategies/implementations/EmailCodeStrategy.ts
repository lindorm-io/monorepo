import {
  AuthStrategyConfig,
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  IdentifierType,
  SendCodeRequestBody,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { randomSecret } from "@lindorm-io/random";
import { createURL } from "@lindorm-io/url";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import {
  authenticateIdentifier,
  createAccountCallback,
  createStrategySessionToken,
  resolveIdentity,
} from "../../handler";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import {
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class EmailCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.ONE_FACTOR,
    hintType: "email",
    identifierType: IdentifierType.EMAIL,
    loa: 2,
    loaMax: 2,
    method: AuthenticationMethod.EMAIL,
    mfaCookie: false,
    primary: true,
    requiresIdentity: false,
    secondary: true,
    strategy: AuthenticationStrategy.EMAIL_CODE,
    weight: 10,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      redis: { strategySessionCache },
      axios: { communicationClient },
    } = ctx;

    const { identifier, identifierType } = strategySession;

    if (!identifier || identifierType !== IdentifierType.EMAIL) {
      throw new ClientError("Invalid input", {
        data: { identifier, identifierType },
      });
    }

    const code = randomSecret(32);
    strategySession.secret = await argon.encrypt(code);

    await strategySessionCache.update(strategySession);

    const strategySessionToken = createStrategySessionToken(ctx, strategySession);

    const url = createURL(configuration.frontend.routes.code_callback, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { strategySessionToken, code },
    });

    await communicationClient.post<never, SendCodeRequestBody>("/admin/send/code", {
      body: {
        content: {
          expires: strategySession.expires,
          url: url.toString(),
        },
        template: "authentication-email-code",
        to: identifier,
        type: identifierType,
      },
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: null,
      strategySessionToken: null,
      visualHint: null,
    };
  }

  public async acknowledge(): Promise<AcknowledgeStrategyResult> {
    throw new ServerError("Strategy does not support this method");
  }

  public async confirm(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
    options: ConfirmStrategyOptions = {},
  ): Promise<Account> {
    const {
      logger,
      mongo: { accountRepository },
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

    logger.debug("Verifying Identity");

    authenticationSession = await resolveIdentity(ctx, authenticationSession, strategySession);

    const { identityId } = await authenticateIdentifier(
      ctx,
      authenticationSession,
      strategySession,
    );

    logger.debug("Resolving Account");

    return accountRepository.findOrCreate({ id: identityId }, createAccountCallback(ctx));
  }
}
