import { IdentifierType } from "../common";

export const isIdentifierStoredSeparately = (type: IdentifierType): boolean => {
  switch (type) {
    case IdentifierType.EMAIL:
    case IdentifierType.EXTERNAL:
    case IdentifierType.PHONE:
      return true;

    default:
      return false;
  }
};
