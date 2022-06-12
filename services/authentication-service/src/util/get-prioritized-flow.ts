import { LoginSession } from "../entity";
import { FlowType } from "../enum";
import { filter, includes, orderBy } from "lodash";
import { FLOW_TYPE_CONFIG } from "../constant";
import { ServerError } from "@lindorm-io/errors";

export const getPrioritizedFlow = (loginSession: LoginSession): FlowType => {
  const { allowedFlows } = loginSession;

  if (!allowedFlows.length) {
    throw new ServerError("Unexpected Error", {
      description: "Login Session has no allowed flows",
    });
  }

  const config = filter(FLOW_TYPE_CONFIG, (item) => includes(allowedFlows, item.name));

  const weighted = config.map((item) =>
    includes(loginSession.requestedAuthenticationMethods, item.name)
      ? { ...item, weight: item.weight * 2 }
      : item,
  );

  const ordered = orderBy(
    weighted,
    ["value", "weight", "valueMax", "mfaCookie"],
    ["desc", "desc", "desc", "desc"],
  );

  return ordered[0].name;
};
