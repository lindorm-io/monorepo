type LindormAddress = {
  careOf: string | null;
};

type StandardAddress = {
  formatted: string | null;
  country: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: string | null;
};

export type OpenIdAddress = LindormAddress & StandardAddress;
