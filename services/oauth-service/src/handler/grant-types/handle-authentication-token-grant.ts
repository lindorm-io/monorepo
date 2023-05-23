import { TokenRequestBody } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../../types";

export const handleAuthenticationTokenGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<void> => {
  // const {
  //   data: { authenticationToken, scope },
  //   entity: { client },
  // };
};
