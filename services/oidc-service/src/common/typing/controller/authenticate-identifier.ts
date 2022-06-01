import { IdentifierType } from "../../enum";

export interface AuthenticateIdentifierRequestData {
  identifier: string;
  identityId?: string;
  provider?: string;
  type: IdentifierType;
}

export interface AuthenticateIdentifierResponseBody {
  identityId: string;
}
