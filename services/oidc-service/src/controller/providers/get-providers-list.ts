import { ControllerResponse } from "@lindorm-io/koa";
import { GetProvidersListResponseBody } from "../../common";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";

export const getProvidersListController: ServerKoaController =
  async (): ControllerResponse<GetProvidersListResponseBody> => ({
    body: { providers: configuration.oidc_providers.map((item) => item.key) },
  });
