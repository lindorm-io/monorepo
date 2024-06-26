import { Dict } from "@lindorm/types";
import { Primitive } from "./Primitive";

export class JsonKit {
  public static stringify<T extends Array<any> | Dict = Dict>(input: T): string {
    return new Primitive(input).toString();
  }

  public static parse<T extends Array<any> | Dict = Dict>(input: any): T {
    return new Primitive<T>(input).toJSON();
  }
}
