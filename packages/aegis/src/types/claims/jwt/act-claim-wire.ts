export type ActClaimWire = {
  sub?: string;
  iss?: string;
  aud?: Array<string>;
  client_id?: string;
  act?: ActClaimWire;
};
