import { Address } from "../entity";
import { IdentityServiceAddress } from "../common";

const EMPTY: IdentityServiceAddress = {
  formatted: null,
  streetAddress: null,
  careOf: null,
  postalCode: null,
  locality: null,
  region: null,
  country: null,
};

export const getAddress = (address: Address | undefined): IdentityServiceAddress => {
  if (!address) return EMPTY;

  const { careOf, country, locality, postalCode, region, streetAddress } = address.toJSON();

  const formatted: Array<string> = [];

  if (streetAddress) {
    formatted.push(streetAddress?.join("\n"));
  }

  if (postalCode && locality) {
    formatted.push(`${postalCode} ${locality}`);
  } else if (postalCode) {
    formatted.push(postalCode);
  } else if (locality) {
    formatted.push(locality);
  }

  if (region) {
    formatted.push(region);
  }

  if (country) {
    formatted.push(country);
  }

  return {
    formatted: formatted.join("\n"),
    streetAddress: streetAddress?.join("\n"),
    careOf,
    postalCode,
    locality,
    region,
    country,
  };
};
