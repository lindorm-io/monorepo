import { FLOW_TYPE_CONFIG, FlowTypeConfig } from "../constant";
import { find } from "lodash";

export const getFlowTypeConfig = (name: string): FlowTypeConfig | undefined =>
  find(FLOW_TYPE_CONFIG, (item) => item.name === name);
