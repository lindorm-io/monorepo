import {
  AuthStrategyConfig,
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
  IdentifierType,
  SendOtpRequestBody,
} from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { Account, AuthenticationSession, StrategySession } from "../../entity";
import {
  authenticateIdentifier,
  createAccountCallback,
  createStrategySessionToken,
  resolveIdentity,
} from "../../handler";
import { argon } from "../../instance";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  AcknowledgeStrategyOptions,
  AcknowledgeStrategyResult,
  AuthenticationStrategyConfig,
  ConfirmStrategyOptions,
  ServerKoaContext,
  StrategyHandler,
} from "../../types";
import { createOtp } from "../../util";

export class EmailOtpStrategy implements StrategyHandler {
  public readonly config: AuthenticationStrategyConfig = {
    factor: AuthenticationFactor.ONE_FACTOR,
    hintType: "email",
    identifierType: IdentifierType.EMAIL,
    loa: 2,
    loaMax: 2,
    method: AuthenticationMethod.EMAIL,
    mfaCookie: true,
    primary: true,
    requiresIdentity: false,
    secondary: true,
    strategy: AuthenticationStrategy.EMAIL_OTP,
    weight: 30,
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

    const confirmLength = 6;
    const otp = (await createOtp(confirmLength)).toString().padStart(confirmLength, "0");

    strategySession.secret = await argon.encrypt(otp);

    await strategySessionCache.update(strategySession);

    await communicationClient.post<never, SendOtpRequestBody>("/admin/send/otp", {
      body: {
        content: {
          expires: strategySession.expires,
          otp,
          visualHint: strategySession.visualHint,
        },
        template: "authentication-email-otp",
        to: identifier,
        type: identifierType,
      },
      middleware: [clientCredentialsMiddleware()],
    });

    return {
      id: strategySession.id,
      acknowledgeCode: null,
      confirmKey: AuthenticationStrategyConfirmKey.OTP,
      confirmLength,
      confirmMode: AuthenticationStrategyConfirmMode.NUMERIC,
      expires: strategySession.expires.toISOString(),
      pollingRequired: false,
      qrCode: null,
      strategySessionToken: createStrategySessionToken(ctx, strategySession),
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
      logger,
      mongo: { accountRepository },
    } = ctx;

    const { otp } = options;

    if (!otp) {
      throw new ClientError("Invalid input", {
        data: { otp },
      });
    }

    logger.debug("Verifying OTP");

    if (!strategySession.secret) {
      throw new ServerError("Invalid strategySession", {
        debug: { secret: strategySession.secret },
      });
    }

    await argon.assert(otp, strategySession.secret);

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
