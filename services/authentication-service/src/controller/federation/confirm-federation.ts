import { GetFederationSessionResponse, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { createURL } from "@lindorm-io/url";
import Joi from "joi";
import { resolveAllowedStrategies } from "../../handler";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus } from "../../util";

type RequestData = {
  session: string;
};

export const confirmFederationSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const confirmFederationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { federationClient },
    redis: { authenticationSessionCache },
    data: { session },
    mongo: { accountRepository },
  } = ctx;

  const {
    data: { callbackId, identityId, levelOfAssurance, provider },
  } = await federationClient.get<GetFederationSessionResponse>("/admin/sessions/:id", {
    params: { id: session },
    middleware: [clientCredentialsMiddleware()],
  });

  const authenticationSession = await authenticationSessionCache.find({ id: callbackId });

  if (authenticationSession.identityId && authenticationSession.identityId !== identityId) {
    throw new ClientError("Invalid identity", {
      description: "Identity ID mismatch",
      debug: {
        expect: authenticationSession.identityId,
        actual: identityId,
      },
    });
  }

  const account = await accountRepository.findOrCreate({ id: identityId });

  authenticationSession.identityId = account.id;
  authenticationSession.confirmedFederationLevel = levelOfAssurance;
  authenticationSession.confirmedFederationProvider = provider;

  authenticationSession.status = calculateAuthenticationStatus(authenticationSession, account);

  if (authenticationSession.status === SessionStatus.PENDING) {
    authenticationSession.allowedStrategies = await resolveAllowedStrategies(
      ctx,
      authenticationSession,
      account,
    );
  }

  await authenticationSessionCache.update(authenticationSession);

  return {
    redirect: createURL(configuration.frontend.routes.federation, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { session: authenticationSession.id },
    }),
  };
};
