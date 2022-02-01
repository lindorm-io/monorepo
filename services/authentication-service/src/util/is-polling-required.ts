import { FlowType } from "../enum";
import { getFlowTypeConfig } from "./get-flow-type-config";

export const isPollingRequired = (flowType: FlowType): boolean => {
  return getFlowTypeConfig(flowType).pollingRequired;
};
