import { sortObjectKeys } from "@lindorm-io/core";
import { assertShaHash } from "@lindorm-io/crypto";
import { EventAttributes, EventStoreAttributes } from "../types";

export const assertChecksum = (attributes: EventStoreAttributes): void => {
  const { checksum, ...rest } = attributes;

  if (!checksum) {
    throw new Error("Missing checksum");
  }

  const events = rest.events.map((event: EventAttributes) => sortObjectKeys(event));
  const sorted = sortObjectKeys({ ...rest, events });
  const data = JSON.stringify(sorted);

  assertShaHash({
    algorithm: "SHA256",
    data,
    format: "base64",
    hash: checksum,
  });
};
