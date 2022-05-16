import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";

export const forgetIdentityController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    axios: { axiosClient },
    repository: {
      browserSessionRepository,
      clientRepository,
      consentSessionRepository,
      refreshSessionRepository,
    },
    token: {
      bearerToken: { subject, token: accessToken },
    },
  } = ctx;

  const clients = await clientRepository.findMany();

  for (const client of clients) {
    if (!client.rtbfUri) continue;

    await axiosClient.post(client.rtbfUri, {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
      retry: 5,
    });
  }

  await browserSessionRepository.destroyMany({ identityId: subject });
  await consentSessionRepository.destroyMany({ identityId: subject });
  await refreshSessionRepository.destroyMany({ identityId: subject });

  return {
    body: {},
  };
};
