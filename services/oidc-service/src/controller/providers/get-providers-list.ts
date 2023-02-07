import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { GetProviderListResponse } from "@lindorm-io/common-types";

type ResponseBody = GetProviderListResponse;

export const getProvidersListController: ServerKoaController =
  async (): ControllerResponse<ResponseBody> => ({
    body: { providers: configuration.oidc_providers.map((item) => item.key) },
  });
