import { GetProviderListResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type ResponseBody = GetProviderListResponse;

export const getProvidersListController: ServerKoaController =
  async (): ControllerResponse<ResponseBody> => ({
    body: { providers: configuration.federation_providers.map((item) => item.key) },
  });
