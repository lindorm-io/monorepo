import { IdentifierType, IdentifierTypes } from "@lindorm-io/common-types";

export const isPrimaryUsedByIdentifier = (type: IdentifierType): boolean => {
  switch (type) {
    case IdentifierTypes.EMAIL:
    case IdentifierTypes.PHONE:
      return true;

    default:
      return false;
  }
};
