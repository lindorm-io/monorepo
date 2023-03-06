import { OpenIdClientType } from "../../../enums";

export type PublicClientInfo = {
  id: string;
  name: string;
  logoUri: string | null;
  type: OpenIdClientType;
};
