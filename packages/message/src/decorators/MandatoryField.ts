import { globalMessageMetadata } from "../utils";

export function MandatoryField(): PropertyDecorator {
  return function (target, key) {
    globalMessageMetadata.addField({
      target: target.constructor,
      key: key.toString(),
      decorator: "MandatoryField",
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
