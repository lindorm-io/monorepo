import { AUTHENTICATION_METHOD_CONFIG } from "../constant";
import { AuthenticationMethod } from "../enum";
import { AuthenticationSession } from "../entity";
import { ServerError } from "@lindorm-io/errors";
import { orderBy } from "lodash";

export const calculatePrioritizedMethod = (
  authenticationSession: AuthenticationSession,
): AuthenticationMethod => {
  if (!authenticationSession.allowedMethods.length) {
    throw new ServerError("Unexpected Error", {
      description: "AuthenticationSession has no allowed methods",
    });
  }

  const config = AUTHENTICATION_METHOD_CONFIG.filter((item) =>
    authenticationSession.allowedMethods.includes(item.name),
  );

  const weighted = config.map((item) =>
    authenticationSession.requestedMethods.includes(item.name)
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
