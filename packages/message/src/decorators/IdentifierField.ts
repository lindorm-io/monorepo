import { randomUUID } from "crypto";
import { globalMessageMetadata } from "../utils";

export function IdentifierField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "IdentifierField",
      enum: null,
      fallback: () => randomUUID(),
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      type: "uuid",
    });
  };
}
