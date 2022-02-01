import { ClientType } from "../../common";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface ResponseBody {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
    type: ClientType;
  };
}

export const getLogoutInfoController: Controller<Context> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { logoutSession },
  } = ctx;

  const { name, description, logoUri, type } = logoutSession;

  return {
    body: { client: { name, description, logoUri, type } },
  };
};
