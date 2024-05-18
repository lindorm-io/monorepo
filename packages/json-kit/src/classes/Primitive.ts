import { isArray, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _getMetaArray } from "../utils/private/get-meta-array";
import { _getMetaObject } from "../utils/private/get-meta-object";
import { _parseArrayValues } from "../utils/private/parse-array-values";
import { _parseObjectValues } from "../utils/private/parse-object-values";
import { _stringifyArrayValues } from "../utils/private/stringify-array-values";
import { _stringifyObjectValues } from "../utils/private/stringify-object-values";

export class Primitive<T extends Array<any> | Dict = Dict> {
  private readonly _data: Array<any> | Dict;
  private readonly _meta: Array<any> | Dict;

  public constructor(input: any) {
    if (isArray(input)) {
      this._data = _stringifyArrayValues(input);
      this._meta = _getMetaArray(input);
    } else if (isObject(input)) {
      this._data = _stringifyObjectValues(input);
      this._meta = _getMetaObject(input);
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
    return JSON.stringify({ json: this._data, meta: this._meta });
  }

  // private

  private static parse(input: any, meta: any): Array<any> | Dict {
    return isArray(input)
      ? _parseArrayValues(input, meta)
      : _parseObjectValues(input, meta);
  }
}
