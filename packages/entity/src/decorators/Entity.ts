import { EntityDecoratorOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export function Entity(options: EntityDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addEntity({
      target,
      decorator: "Entity",
      cache: options?.cache || null,
      database: options?.database || null,
      name: options?.name || null,
      namespace: options?.namespace || null,
    });
  };
}
