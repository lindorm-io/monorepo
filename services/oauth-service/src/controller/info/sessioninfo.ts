import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { flatten, uniq } from "lodash";
import {
  AccessSessionAttributes,
  BrowserSessionAttributes,
  ClientAttributes,
  RefreshSessionAttributes,
} from "../../entity";

type ResponseBody = {
  accessSessions: Array<Partial<AccessSessionAttributes>>;
  browserSessions: Array<Partial<BrowserSessionAttributes>>;
  clients: Array<Partial<ClientAttributes>>;
  refreshSessions: Array<Partial<RefreshSessionAttributes>>;
};

export const sessioninfoController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    token: {
      bearerToken: { subject: identityId },
    },
    repository: {
      accessSessionRepository,
      browserSessionRepository,
      clientRepository,
      refreshSessionRepository,
    },
  } = ctx;

  const accessList = await accessSessionRepository.findMany({ identityId });
  const browserList = await browserSessionRepository.findMany({ identityId });
  const refreshList = await refreshSessionRepository.findMany({ identityId });

  const accessSessions: Array<Partial<AccessSessionAttributes>> = [];
  const browserSessions: Array<Partial<BrowserSessionAttributes>> = [];
  const clients: Array<Partial<ClientAttributes>> = [];
  const clientsArray: Array<string | Array<string>> = [];
  const refreshSessions: Array<Partial<RefreshSessionAttributes>> = [];

  for (const item of accessList) {
    clientsArray.push(item.clientId);

    accessSessions.push({
      id: item.id,
      clientId: item.clientId,
      latestAuthentication: item.latestAuthentication,
      levelOfAssurance: item.levelOfAssurance,
      scopes: item.scopes,
    });
  }

  for (const item of browserList) {
    browserSessions.push({
      id: item.id,
      latestAuthentication: item.latestAuthentication,
      levelOfAssurance: item.levelOfAssurance,
      remember: item.remember,
    });
  }

  for (const item of refreshList) {
    clientsArray.push(item.clientId);

    refreshSessions.push({
      id: item.id,
      clientId: item.clientId,
      expires: item.expires,
      latestAuthentication: item.latestAuthentication,
      levelOfAssurance: item.levelOfAssurance,
      scopes: item.scopes,
    });
  }

  const clientsUniq = uniq(flatten(clientsArray)).sort();

  for (const id of clientsUniq) {
    const client = await clientRepository.find({ id });

    clients.push({
      id: client.id,
      name: client.name,
      description: client.description,
    });
  }

  return { body: { accessSessions, browserSessions, clients, refreshSessions } };
};
