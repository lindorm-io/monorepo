import { IdentifierType } from "../../../../enums";

export type AddIdentifierRequestBody = {
  identityId: string;
  identifier: string;
  label: string | null;
  provider?: string;
  type: IdentifierType;
  verified: boolean;
};
