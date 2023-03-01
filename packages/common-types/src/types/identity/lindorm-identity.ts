import { LindormIdentityAddress } from "./lindorm-identity-address";
import { LindormIdentityEmail } from "./lindorm-identity-email";
import { LindormIdentityPhoneNumber } from "./lindorm-identity-phone-number";
import { NamingSystem } from "../../enums";
import { LindormIdentityNIN } from "./lindorm-identity-nin";
import { LindormIdentitySSN } from "./lindorm-identity-ssn";

export type LindormIdentity = {
  active: boolean;
  birthDate: string | null;
  displayName: string | null;
  familyName: string | null;
  gender: string | null;
  givenName: string | null;
  avatarUri: string | null;
  locale: string | null;
  middleName: string | null;
  namingSystem: NamingSystem;
  nickname: string | null;
  picture: string | null;
  preferredAccessibility: Array<string>;
  preferredUsername: string | null;
  profile: string | null;
  pronouns: string | null;
  takenName: string | null;
  username: string | null;
  website: string | null;
  zoneInfo: string | null;

  addresses: Array<LindormIdentityAddress>;
  connectedProviders: Array<string>;
  emails: Array<LindormIdentityEmail>;
  nationalIdentityNumbers: Array<LindormIdentityNIN>;
  phoneNumbers: Array<LindormIdentityPhoneNumber>;
  socialSecurityNumbers: Array<LindormIdentitySSN>;
};
