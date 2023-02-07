import { Identifier } from "../entity";
import { IdentifierType } from "@lindorm-io/common-types";

type PublicIdentifier = {
  id: string;
  label: string | null;
  primary: boolean;
  value: string;
  verified: boolean;
};

export const getIdentifiersList = (
  identifiers: Array<Identifier>,
  type: IdentifierType,
): Array<PublicIdentifier> =>
  identifiers
    .filter((item) => item.type === type)
    .map((item) => ({
      id: item.id,
      label: item.label,
      primary: item.primary,
      value: item.identifier,
      verified: item.verified,
    }));
