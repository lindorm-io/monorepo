import { MetaSource } from "../types";
import { globalEntityMetadata } from "../utils";

export function PrimarySource<T extends MetaSource>(source: T): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addPrimarySource<T>({
      target,
      source,
    });
  };
}
