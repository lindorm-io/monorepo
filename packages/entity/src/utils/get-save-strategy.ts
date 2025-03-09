import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { SaveStrategy } from "../types";
import { globalEntityMetadata } from "./global";

export const getSaveStrategy = <E extends IEntity>(
  Entity: Constructor<E>,
  entity: E,
): SaveStrategy => {
  const metadata = globalEntityMetadata.get(Entity);

  const generate = metadata.generated.map((g) => entity[g.key]);
  const version = metadata.columns.find((c) => c.decorator === "VersionColumn");

  if (version && entity[version.key] === 0) {
    return "insert";
  }

  if (version && entity[version.key] > 0) {
    return "update";
  }

  if (generate.length && generate.some((v) => !v)) {
    return "insert";
  }

  if (generate.length && generate.every((v) => Boolean(v))) {
    return "update";
  }

  return "unknown";
};
