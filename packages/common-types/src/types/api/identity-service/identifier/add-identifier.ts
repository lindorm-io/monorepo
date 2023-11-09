import { IdentifierType } from "@lindorm-io/common-enums";

export type AddIdentifierRequestBody = {
  identityId: string;
  identifier: string;
  label: string | null;
  provider?: string;
  type: IdentifierType;
  verified: boolean;
};
