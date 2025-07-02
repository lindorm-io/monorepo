import { globalMessageMetadata } from "../utils";

export function PersistentField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "PersistentField",
      enum: null,
      fallback: () => false,
      max: null,
      min: null,
      nullable: false,
      optional: false,
      schema: null,
      type: "boolean",
    });
  };
}
