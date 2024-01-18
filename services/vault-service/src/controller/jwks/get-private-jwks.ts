import { ControllerResponse } from "@lindorm-io/koa";
import { ExternalJwk } from "../../../../../packages/jwk/dist";
import { ServerKoaController } from "../../types";

type ResponseBody = {
  keys: Array<ExternalJwk>;
};

export const getPrivateJwksController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const { keystore } = ctx;

  return { body: { keys: keystore.getJwks("both") } };
};
