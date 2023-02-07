import { IdentifierType } from "../../auth";

export type AuthenticateIdentifierRequestBody = {
  identifier: string;
  identityId?: string;
  provider?: string;
  type: IdentifierType;
};

export type AuthenticateIdentifierResponse = {
  identityId: string;
};
