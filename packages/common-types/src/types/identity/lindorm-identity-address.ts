export type LindormIdentityAddress = {
  careOf: string | null;
  country: string | null;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  primary: boolean;
  region: string | null;
  streetAddress: Array<string>;
};
