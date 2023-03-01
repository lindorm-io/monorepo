import { Identity } from "../entity";
import { NamingSystem } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";

export const getName = (identity: Identity): string | null => {
  const { familyName, givenName, namingSystem, takenName } = identity;

  const preferredName = takenName ? takenName : givenName;

  if (!familyName) {
    return preferredName;
  }

  if (!preferredName) {
    return familyName;
  }

  switch (namingSystem) {
    case NamingSystem.GIVEN_FAMILY:
      return `${preferredName} ${familyName}`;

    case NamingSystem.FAMILY_GIVEN:
      return `${familyName} ${preferredName}`;

    default:
      throw new ServerError("Unknown naming system", {
        debug: { namingSystem },
      });
  }
};
