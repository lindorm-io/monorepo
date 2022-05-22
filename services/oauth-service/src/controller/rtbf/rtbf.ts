import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
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

    await axiosClient.get(client.rtbfUri, {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
      retry: 5,
    });
  }

  await browserSessionRepository.deleteMany({ identityId: subject });
  await consentSessionRepository.deleteMany({ identityId: subject });
  await refreshSessionRepository.deleteMany({ identityId: subject });

  return {
    body: {},
  };
};
