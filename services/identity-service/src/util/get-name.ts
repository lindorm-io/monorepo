import { NamingSystem } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { Identity } from "../entity";

export const getName = (identity: Identity): string | null => {
  const { familyName, givenName, namingSystem, preferredName } = identity;

  const preference = preferredName ? preferredName : givenName;

  if (!familyName) {
    return preference;
  }

  if (!preference) {
    return familyName;
  }

  switch (namingSystem) {
    case NamingSystem.GIVEN_FAMILY:
      return `${preference} ${familyName}`;

    case NamingSystem.FAMILY_GIVEN:
      return `${familyName} ${preference}`;

    default:
      throw new ServerError("Unknown naming system", {
        debug: { namingSystem },
      });
  }
};
