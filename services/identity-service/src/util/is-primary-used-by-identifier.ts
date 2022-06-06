import { IdentifierType } from "../common";

export const isPrimaryUsedByIdentifier = (type: IdentifierType): boolean => {
  switch (type) {
    case IdentifierType.EMAIL:
    case IdentifierType.PHONE:
      return true;

    default:
      return false;
  }
};
