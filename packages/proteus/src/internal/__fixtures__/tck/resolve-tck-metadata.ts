// Storage-name lookup for the TCK's raw-row readers.
//
// A raw read has to address the table/collection/key the driver actually wrote,
// which follows the source's naming strategy — so it must come from resolved
// metadata, never from the class name.

import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { ProteusSource } from "../../../classes/ProteusSource.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

export const resolveTckMetadata = (
  source: ProteusSource,
  target: Constructor<IEntity>,
): EntityMetadata => {
  const metadata = source
    .getEntityMetadata()
    .find((m) => (m.target as unknown) === target);

  if (!metadata) {
    throw new Error(`[TCK] entity "${target.name}" is not registered on the source`);
  }

  return metadata;
};

/** Storage-level table/collection name under the source's naming strategy. */
export const resolveTckStorageName = (
  source: ProteusSource,
  target: Constructor<IEntity>,
): string => resolveTckMetadata(source, target).entity.name;
