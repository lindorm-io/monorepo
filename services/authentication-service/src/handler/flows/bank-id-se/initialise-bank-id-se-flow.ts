import { LoginSession, FlowSession } from "../../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../../types";

export const initialiseBankIdSeFlow = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  flowSession: FlowSession,
): Promise<void> => {
  console.log(ctx, loginSession, flowSession);

  throw new ServerError("Flow not implemented");
};
