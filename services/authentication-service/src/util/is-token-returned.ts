import { FlowType } from "../enum";
import { getFlowTypeConfig } from "./get-flow-type-config";

export const isTokenReturned = (flowType: FlowType): boolean => {
  return getFlowTypeConfig(flowType).tokenReturn;
};
