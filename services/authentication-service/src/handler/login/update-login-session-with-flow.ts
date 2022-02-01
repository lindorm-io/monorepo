import { Account, LoginSession, FlowSession } from "../../entity";
import { Context } from "../../types";
import { calculateLevelOfAssurance } from "../../util";
import { resolveAllowedFlows } from "./resolve-allowed-flows";

export const updateLoginSessionWithFlow = async (
  ctx: Context,
  account: Account,
  loginSession: LoginSession,
  flowSession: FlowSession,
): Promise<LoginSession> => {
  const {
    cache: { loginSessionCache },
  } = ctx;

  loginSession.amrValues.push(flowSession.type);
  loginSession.identityId = account.id;
  loginSession.levelOfAssurance = calculateLevelOfAssurance(loginSession);

  loginSession = await resolveAllowedFlows(ctx, loginSession, account);

  return await loginSessionCache.update(loginSession);
};
