import { Address } from "../entity";

interface PublicAddress {
  id: string;
  careOf: string;
  country: string;
  label: string;
  locality: string;
  postalCode: string;
  region: string;
  streetAddress: Array<string>;
}

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
