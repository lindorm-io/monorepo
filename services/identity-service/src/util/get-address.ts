import { Identity } from "../entity";
import { IdentityServiceAddress } from "../common";

export const getAddress = (identity: Identity): IdentityServiceAddress => {
  const {
    address: { careOf, country, locality, postalCode, region, streetAddress },
  } = identity.toJSON();

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
