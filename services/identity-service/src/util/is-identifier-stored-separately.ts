import { IdentifierType, IdentifierTypes } from "@lindorm-io/common-types";

export const isIdentifierStoredSeparately = (type: IdentifierType): boolean => {
  switch (type) {
    case IdentifierTypes.EMAIL:
    case IdentifierTypes.EXTERNAL:
    case IdentifierTypes.PHONE:
      return true;

    default:
      return false;
  }
};
