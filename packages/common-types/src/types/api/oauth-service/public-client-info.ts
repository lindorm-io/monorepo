import { OpenIdClientType } from "../../../enums";

export type PublicClientInfo = {
  name: string;
  logoUri: string | null;
  tenant: string | null;
  type: OpenIdClientType;
};
