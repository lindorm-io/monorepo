import { Dict } from "@lindorm/types";
import { Primitive } from "./Primitive";

export class JsonKit {
  public static buffer<T extends Array<any> | Dict = Dict>(input: T): Buffer {
    return new Primitive(input).toBuffer();
  }

  public static parse<T extends Array<any> | Dict = Dict>(input: any): T {
    return new Primitive<T>(input).toJSON();
  }

  public static primitive<T extends Array<any> | Dict = Dict>(input: any): Primitive<T> {
    return new Primitive(input);
  }

  public static stringify<T extends Array<any> | Dict = Dict>(input: T): string {
    return new Primitive(input).toString();
  }
}
