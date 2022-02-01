import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { flatten, uniq } from "lodash";
import {
  BrowserSessionAttributes,
  ClientAttributes,
  ConsentSessionAttributes,
  RefreshSessionAttributes,
} from "../../entity";

interface ResponseBody {
  browserSessions: Array<Partial<BrowserSessionAttributes>>;
  clients: Array<Partial<ClientAttributes>>;
  consentSessions: Array<Partial<ConsentSessionAttributes>>;
  refreshSessions: Array<Partial<RefreshSessionAttributes>>;
}

export const sessioninfoController: Controller<Context> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { clientCache },
    token: {
      bearerToken: { subject: identityId },
    },
    repository: { browserSessionRepository, consentSessionRepository, refreshSessionRepository },
  } = ctx;

  const browserList = await browserSessionRepository.findMany({ identityId });
  const consentList = await consentSessionRepository.findMany({ identityId });
  const refreshList = await refreshSessionRepository.findMany({ identityId });

  const browserSessions: Array<Partial<BrowserSessionAttributes>> = [];
  const clients: Array<Partial<ClientAttributes>> = [];
  const clientsArray: Array<string | Array<string>> = [];
  const consentSessions: Array<Partial<ConsentSessionAttributes>> = [];
  const refreshSessions: Array<Partial<RefreshSessionAttributes>> = [];

  for (const item of browserList) {
    clientsArray.push(item.clients);

    browserSessions.push({
      clients: item.clients,
      expires: item.expires,
      levelOfAssurance: item.levelOfAssurance,
      remember: item.remember,
    });
  }

  for (const item of consentList) {
    clientsArray.push(item.clientId);

    consentSessions.push({
      clientId: item.clientId,
      scopes: item.scopes,
    });
  }

  for (const item of refreshList) {
    clientsArray.push(item.clientId);

    refreshSessions.push({
      clientId: item.clientId,
      expires: item.expires,
      levelOfAssurance: item.levelOfAssurance,
    });
  }

  const clientsUniq = uniq(flatten(clientsArray));

  for (const id of clientsUniq) {
    const client = await clientCache.find({ id });

    clients.push({
      id: client.id,
      name: client.name,
      description: client.description,
    });
  }

  return {
    body: {
      browserSessions,
      clients,
      consentSessions,
      refreshSessions,
    },
  };
};
