import { Address, Identity } from "../../entity";
import { ServerKoaContext } from "../../types";
import { OpenIdAddress } from "@lindorm-io/common-types";

export const addAddressFromUserinfo = async (
  ctx: ServerKoaContext,
  identity: Identity,
  openIDAddress: OpenIdAddress,
): Promise<Address> => {
  const {
    repository: { addressRepository },
  } = ctx;

  const country = openIDAddress.country?.trim();
  const locality = openIDAddress.locality?.trim();
  const postalCode = openIDAddress.postalCode?.trim();
  const region = openIDAddress.region?.trim();
  const streetAddress = openIDAddress.streetAddress?.trim();

  const addresses = await addressRepository.findMany({ identityId: identity.id });
  const filtered = addresses.filter(
    (item) =>
      item.country.toLowerCase() === country.toLowerCase() &&
      item.locality.toLowerCase() === locality.toLowerCase() &&
      item.postalCode.toLowerCase() === postalCode.toLowerCase() &&
      item.region.toLowerCase() === region.toLowerCase() &&
      item.streetAddress.join(" ").toLowerCase() === streetAddress.replace("\n", " ").toLowerCase(),
  );

  if (filtered.length) {
    return filtered[0];
  }

  return await addressRepository.create(
    new Address({
      careOf: null,
      country,
      identityId: identity.id,
      locality,
      postalCode,
      primary: addresses.length < 1,
      region,
      streetAddress: streetAddress.split("\n"),
    }),
  );
};
