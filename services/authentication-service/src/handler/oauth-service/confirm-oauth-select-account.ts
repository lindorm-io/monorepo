import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import {
  ConfirmSelectAccountRequestBody,
  ConfirmSelectAccountRequestParams,
  ConfirmSelectAccountResponse,
} from "@lindorm-io/common-types";

export const confirmOauthSelectAccount = async (
  ctx: ServerKoaContext,
  id: string,
  body: ConfirmSelectAccountRequestBody,
): Promise<ConfirmSelectAccountResponse> => {
  const {
    axios: { oauthClient },
  } = ctx;

  const { data } = await oauthClient.post<
    ConfirmSelectAccountResponse,
    ConfirmSelectAccountRequestBody,
    unknown,
    ConfirmSelectAccountRequestParams
  >("/admin/sessions/select-account/:id/confirm", {
    params: { id },
    body,
    middleware: [clientCredentialsMiddleware()],
  });

  return data;
};
