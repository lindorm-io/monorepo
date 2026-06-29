import type { Dict } from "@lindorm/types";
import { Primitive } from "./Primitive.js";

export class JsonKit {
  static buffer<T extends Array<any> | Dict = Dict>(input: T): Buffer {
    return new Primitive(input).toBuffer();
  }

  static parse<T extends Array<any> | Dict = Dict>(input: any): T {
    return new Primitive<T>(input).toJSON();
  }

  static primitive<T extends Array<any> | Dict = Dict>(input: any): Primitive<T> {
    return new Primitive(input);
  }

  static stringify<T extends Array<any> | Dict = Dict>(input: T): string {
    return new Primitive(input).toString();
  }
}
