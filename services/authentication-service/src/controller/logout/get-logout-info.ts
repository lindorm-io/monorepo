import { ClientType } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";

interface ResponseBody {
  client: {
    name: string;
    description: string | null;
    logoUri: string | null;
    type: ClientType;
  };
}

export const getLogoutInfoController: ServerKoaController = async (
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
