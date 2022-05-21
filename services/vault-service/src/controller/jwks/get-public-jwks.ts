import { ControllerResponse } from "@lindorm-io/koa";
import { JWK } from "@lindorm-io/key-pair";
import { ServerKoaController } from "../../types";

interface ResponseBody {
  keys: Array<JWK>;
}

export const getPublicJwksController: ServerKoaController = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const { keystore } = ctx;

  return {
    body: {
      keys: keystore.getJWKS(),
    },
  };
};
