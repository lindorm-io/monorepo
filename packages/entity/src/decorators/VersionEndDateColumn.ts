import { globalEntityMetadata } from "../utils";

export function VersionEndDateColumn(): PropertyDecorator {
  return function (target, key) {
    globalEntityMetadata.addColumn({
      target: target.constructor,
      key: key.toString(),
      decorator: "VersionEndDateColumn",
      enum: null,
      fallback: null,
      max: null,
      min: null,
      nullable: true,
      optional: false,
      readonly: false,
      schema: null,
      type: "date",
    });
  };
}
