import { difference } from "lodash";
import { ALLOWED_ACR_VALUES } from "../constant";
import { ClientError } from "@lindorm-io/errors";

export const assertAcrValues = (acrValues: Array<string>): void => {
  if (!acrValues.length) {
    throw new ClientError("Invalid ACR values", {
      description: "ACR values missing",
    });
  }

  const acrDiff = difference(acrValues, ALLOWED_ACR_VALUES);

  if (!acrDiff.length) return;

  throw new ClientError("Invalid ACR values", {
    description: "The provided ACR values are invalid",
    data: {
      allowed: ALLOWED_ACR_VALUES,
      diff: acrDiff,
    },
  });
};
