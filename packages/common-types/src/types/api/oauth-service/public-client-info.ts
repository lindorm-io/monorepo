import { OpenIdClientType } from "../../../enums";

export type PublicClientInfo = {
  id: string;
  name: string;
  logoUri: string | null;
  singleSignOn: boolean;
  type: OpenIdClientType;
};
