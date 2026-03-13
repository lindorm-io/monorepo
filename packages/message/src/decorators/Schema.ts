import { Constructor } from "@lindorm/types";
import { z } from "zod/v4";
import { IMessage } from "../interfaces";
import { globalMessageMetadata } from "../utils";

export function Schema<T extends z.ZodType>(
  schema: T,
): <C extends Constructor<IMessage & z.infer<T>>>(ctor: C) => void {
  return function <C extends Constructor<IMessage & z.infer<T>>>(target: C) {
    globalMessageMetadata.addSchema({
      target,
      schema: schema as z.ZodType<any>,
    });
  };
}
