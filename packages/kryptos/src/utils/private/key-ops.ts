import { KryptosOperation, KryptosUse } from "../../types";

export const _calculateKeyOps = (use: KryptosUse): Array<KryptosOperation> => {
  switch (use) {
    case "enc":
      return ["encrypt", "decrypt"];

    case "sig":
      return ["sign", "verify"];

    default:
      return [];
  }
};
