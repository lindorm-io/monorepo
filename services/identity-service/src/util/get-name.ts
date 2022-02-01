import { Identity } from "../entity";
import { NamingSystem } from "../enum";
import { ServerError } from "@lindorm-io/errors";

export const getName = (identity: Identity): string => {
  const { familyName, givenName, namingSystem } = identity;

  if (!familyName) {
    return givenName;
  }

  if (!givenName) {
    return familyName;
  }

  switch (namingSystem) {
    case NamingSystem.GIVEN_FAMILY:
      return `${givenName} ${familyName}`;

    case NamingSystem.FAMILY_GIVEN:
      return `${familyName} ${givenName}`;

    default:
      throw new ServerError("Unknown naming system", {
        debug: { namingSystem },
      });
  }
};
