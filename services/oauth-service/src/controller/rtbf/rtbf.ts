import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

export const rtbfController: ServerKoaController = async (ctx): ControllerResponse => {
  const {
    axios: { axiosClient },
    mongo: { browserSessionRepository, clientRepository, clientSessionRepository },
    token: {
      bearerToken: { subject: identityId, token },
    },
  } = ctx;

  const clients = await clientRepository.findMany();

  for (const client of clients) {
    if (!client.rtbfUri) continue;

    await axiosClient.get(client.rtbfUri, {
      middleware: [axiosBearerAuthMiddleware(token)],
    });
  }

  await browserSessionRepository.deleteMany({ identityId });
  await clientSessionRepository.deleteMany({ identityId });
};
