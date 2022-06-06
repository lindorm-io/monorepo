import { Address, AddressOptions } from "../../entity";
import { randomUUID } from "crypto";

export const createTestAddress = (options: Partial<AddressOptions> = {}): Address =>
  new Address({
    careOf: "Gustav Torsson",
    country: "Sweden",
    identityId: randomUUID(),
    label: "work",
    locality: "Stockholm",
    postalCode: "12345",
    primary: true,
    region: "Stockholm",
    streetAddress: ["Long Street Name 12", "Second Row"],
    ...options,
  });
