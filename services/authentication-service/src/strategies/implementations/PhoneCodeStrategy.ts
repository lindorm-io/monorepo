import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import {
  authenticateIdentifier,
  createAccountCallback,
  createStrategySessionToken,
  resolveIdentity,
} from "../../handler";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
  SendCodeRequestBody,
} from "@lindorm-io/common-types";

export class PhoneCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    identifierHint: "phone",
    identifierType: IdentifierType.PHONE,
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.PHONE,
    methodsMax: 9,
    methodsMin: 1,
    mfaCookie: true,
    strategy: AuthenticationStrategy.PHONE_OTP,
    weight: 10,
  };

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      cache: { strategySessionCache },
      axios: { communicationClient },
    } = ctx;

    const { identifier, identifierType } = strategySession;

    if (!identifier || identifierType !== IdentifierType.PHONE) {
      throw new ClientError("Invalid input", {
        data: { identifier, identifierType },
      });
    }

    const code = randomString(32);
    strategySession.secret = await argon.encrypt(code);

    await strategySessionCache.update(strategySession);

    const strategySessionToken = createStrategySessionToken(ctx, strategySession);

    const url = createURL(configuration.frontend.routes.code_callback, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { strategySessionToken, code },
    });

    const body: SendCodeRequestBody = {
      content: {
        expires: strategySession.expires,
        url: url.toString(),
      },
      template: "authentication-phone-code",
      to: identifier,
      type: identifierType,
    };

    await communicationClient.post("/admin/send/code", {
      body,
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expires: strategySession.expires.toISOString(),
      pollingRequired: true,
      qrCode: null,
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
