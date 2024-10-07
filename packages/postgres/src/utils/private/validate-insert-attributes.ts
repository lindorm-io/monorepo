import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";

export const validateInsertAttributes = <T extends Dict>(attributes: Array<T>): void => {
  if (!isArray(attributes)) {
    throw new TypeError("Attributes must be an array");
  }

  if (!attributes.length) {
    throw new TypeError("Attributes must contain at least one item");
  }

  const keys = Object.keys(attributes[0]);

  for (const attribute of attributes) {
    if (!isObject(attribute)) {
      throw new TypeError("Attribute must be an object");
    }

    if (!Object.keys(attribute).length) {
      throw new TypeError("Attributes must contain at least one key");
    }

    if (Object.keys(attribute).length !== keys.length) {
      throw new TypeError("Attributes must contain the same keys");
    }

    if (Object.keys(attribute).some((key) => !keys.includes(key))) {
      throw new TypeError("Attributes must contain the same keys");
    }

    if (keys.some((key) => !Object.keys(attribute).includes(key))) {
      throw new TypeError("Attributes must contain the same keys");
    }
  }
};
