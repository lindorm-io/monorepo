import { isArray, isBuffer, isObjectLike, isString } from "@lindorm/is";
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
  private readonly _data: T;
  private readonly _meta: Array<any> | Dict;

  public constructor(input: any) {
    if (isBuffer(input)) {
      const { __meta__, __array__, __record__ } = JSON.parse(input.toString());
      this._data = __array__ ? __array__ : __record__;
      this._meta = __meta__;
    } else if (isArray(input)) {
      this._data = stringifyArrayValues(input) as T;
      this._meta = getMetaArray(input);
    } else if (
      isObjectLike(input) &&
      !input.__meta__ &&
      !input.__array__ &&
      !input.__record__
    ) {
      this._data = stringifyObjectValues(input) as T;
      this._meta = getMetaObject(input);
    } else if (
      isObjectLike(input) &&
      input.__meta__ &&
      (input.__array__ || input.__record__)
    ) {
      const { __meta__, __array__, __record__ } = input;
      this._data = __array__ ? __array__ : __record__;
      this._meta = __meta__;
    } else if (isString(input)) {
      const { __meta__, __array__, __record__ } = JSON.parse(input);
      this._data = __array__ ? __array__ : __record__;
      this._meta = __meta__;
    } else {
      throw new TypeError("Expected input to be an array or object");
    }
  }

  // getters

  public get data(): T {
    return this._data;
  }

  public get meta(): Array<any> | Dict {
    return this._meta;
  }

  // public

  public toBuffer(): Buffer {
    return Buffer.from(this.toString());
  }

  public toJSON(): T {
    return Primitive.parse(this._data, this._meta) as T;
  }

  public toString(): string {
    const key = isArray(this._data) ? "__array__" : "__record__";
    return JSON.stringify({ __meta__: this._meta, [key]: this._data });
  }

  // private

  private static parse(input: any, meta: any): Array<any> | Dict {
    return isArray(input)
      ? parseArrayValues(input, meta)
      : parseObjectValues(input, meta);
  }
}
