import { isArray, isObjectLike, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import {
  getMetaArray,
  getMetaObject,
  parseArrayValues,
  parseObjectValues,
  stringifyArrayValues,
  stringifyObjectValues,
} from "../utils/private";

export class Primitive<T extends Array<any> | Dict = Dict> {
  private readonly _data: Array<any> | Dict;
  private readonly _meta: Array<any> | Dict;

  public constructor(input: any) {
    if (isArray(input)) {
      this._data = stringifyArrayValues(input);
      this._meta = getMetaArray(input);
    } else if (isObjectLike(input)) {
      this._data = stringifyObjectValues(input);
      this._meta = getMetaObject(input);
    } else if (isString(input)) {
      const { data, meta } = JSON.parse(input);

      this._data = data;
      this._meta = meta;
    } else {
      throw new TypeError("Expected input to be an array or object");
    }
  }

  // getters

  public get data(): Array<any> | Dict {
    return this._data;
  }

  public get meta(): Array<any> | Dict {
    return this._meta;
  }

  // public

  public toJSON(): T {
    return Primitive.parse(this._data, this._meta) as T;
  }

  public toString(): string {
    return JSON.stringify({ data: this._data, meta: this._meta });
  }

  // private

  private static parse(input: any, meta: any): Array<any> | Dict {
    return isArray(input)
      ? parseArrayValues(input, meta)
      : parseObjectValues(input, meta);
  }
}
