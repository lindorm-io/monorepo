import { Address } from "../entity";

type PublicAddress = {
  id: string;
  careOf: string | null;
  country: string | null;
  label: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: Array<string>;
};

export const getAddressList = (addresses: Array<Address>): Array<PublicAddress> =>
  addresses.map((item) => ({
    id: item.id,
    careOf: item.careOf,
    country: item.country,
    label: item.label,
    locality: item.locality,
    postalCode: item.postalCode,
    region: item.region,
    streetAddress: item.streetAddress,
  }));
