import { Account, AuthenticationSession, StrategySession } from "../../entity";
import { AuthenticationStrategyConfig, ServerKoaContext } from "../../types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ConfirmStrategyOptions, StrategyBase } from "../../class";
import { argon } from "../../instance";
import { authenticateIdentifier, createAccountCallback, resolveIdentity } from "../../handler";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { randomString } from "@lindorm-io/random";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  AuthStrategyConfig,
  IdentifierType,
  SendCodeRequestBody,
} from "@lindorm-io/common-types";

export class EmailCodeStrategy extends StrategyBase {
  public config(): AuthenticationStrategyConfig {
    return {
      identifierHint: "email",
      identifierType: IdentifierType.EMAIL,
      loa: 2,
      loaMax: 2,
      method: AuthenticationMethod.EMAIL,
      methodsMax: 9,
      methodsMin: 0,
      mfaCookie: false,
      strategy: AuthenticationStrategy.EMAIL_CODE,
      weight: 10,
    };
  }

  public async initialise(
    ctx: ServerKoaContext,
    authenticationSession: AuthenticationSession,
    strategySession: StrategySession,
  ): Promise<AuthStrategyConfig> {
    const {
      cache: { strategySessionCache },
      axios: { communicationClient, oauthClient },
    } = ctx;

    const { identifier, identifierType } = strategySession;

    if (!identifier || identifierType !== IdentifierType.EMAIL) {
      throw new ClientError("Invalid input", {
        data: { identifier, identifierType },
      });
    }

    const code = randomString(32);
    strategySession.secret = await argon.encrypt(code);

    await strategySessionCache.update(strategySession);

    const strategySessionToken = this.sessionToken(ctx, strategySession);

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
      template: "authentication-email-code",
      to: identifier,
      type: identifierType,
    };

    await communicationClient.post("/admin/send/code", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });

    return {
      id: strategySession.id,
      confirmKey: AuthenticationStrategyConfirmKey.CODE,
      confirmLength: null,
      confirmMode: AuthenticationStrategyConfirmMode.NONE,
      displayCode: null,
      expiresIn: this.expiresIn(strategySession),
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
