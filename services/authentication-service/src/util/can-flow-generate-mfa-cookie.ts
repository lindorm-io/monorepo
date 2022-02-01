import { FlowType } from "../enum";
import { LoginSession } from "../entity";
import { getFlowTypeConfig } from "./get-flow-type-config";

export const canFlowGenerateMfaCookie = (
  loginSession: LoginSession,
  flowType: FlowType,
): boolean => {
  if (!loginSession.remember) {
    return false;
  }

  if (!loginSession.identityId) {
    return false;
  }

  if (loginSession.amrValues.length < 2) {
    return false;
  }

  return getFlowTypeConfig(flowType).mfaCookie;
};
