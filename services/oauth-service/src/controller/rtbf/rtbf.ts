import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    axios: { axiosClient },
    repository: {
      accessSessionRepository,
      browserSessionRepository,
      clientRepository,
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
    });
  }

  await accessSessionRepository.deleteMany({ identityId: subject });
  await browserSessionRepository.deleteMany({ identityId: subject });
  await refreshSessionRepository.deleteMany({ identityId: subject });
};
