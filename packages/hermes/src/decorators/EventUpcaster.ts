import type { Constructor } from "@lindorm/types";
import { stageUpcaster } from "../internal/metadata/index.js";

export const EventUpcaster = <From, To>(from: Constructor<From>, to: Constructor<To>) => {
  return <This>(
    _target: (this: This, data: From) => To,
    context: ClassMethodDecoratorContext<This, (data: From) => To>,
  ): void => {
    stageUpcaster(context.metadata, { from, to, method: String(context.name) });
  };
};
