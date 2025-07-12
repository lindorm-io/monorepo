import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { EntityDecoratorOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export function Entity(options: EntityDecoratorOptions = {}): ClassDecorator {
  return function (target) {
    globalEntityMetadata.addEntity({
      target: target as unknown as Constructor<IEntity>,
      decorator: "Entity",
      cache: options?.cache || null,
      database: options?.database || null,
      name: options?.name || target.name,
      namespace: options?.namespace || null,
    });
  };
}
