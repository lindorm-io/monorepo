import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  IdentifierType,
} from "@lindorm-io/common-enums";
import { AuthStrategyConfig, SendCodeRequestBody } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { randomString } from "@lindorm-io/random";
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
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";

export class PhoneCodeStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.ONE_FACTOR,
    hintType: "phone",
    identifierType: IdentifierType.PHONE,
    loa: 2,
    loaMax: 3,
    method: AuthenticationMethod.PHONE,
    mfaCookie: true,
    primary: true,
    requiresIdentity: false,
    secondary: true,
    strategy: AuthenticationStrategy.PHONE_CODE,
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

    await communicationClient.post<never, SendCodeRequestBody>("/admin/send/code", {
      body: {
        content: {
          expires: strategySession.expires,
          url: url.toString(),
        },
        template: "authentication-phone-code",
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
