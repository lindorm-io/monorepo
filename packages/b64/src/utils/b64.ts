import { Base64Encoding } from "../types";
import { decode } from "./private/decode";
import { encodeBase64, encodeBase64Url } from "./private/encode";

export class B64 {
  public thing: string;

  public constructor(thing: string = "thing") {
    this.thing = thing;
  }

  public thello(): string {
    return this.thing;
  }

  public static encode(
    input: Buffer | string,
    encoding: Base64Encoding = "base64",
  ): string {
    return encoding === "base64" || encoding === "b64"
      ? encodeBase64(input)
      : encodeBase64Url(input);
  }

  public static toBuffer(input: string, encoding?: Base64Encoding): Buffer {
    return decode(input, encoding);
  }

  public static toString(input: string, encoding?: Base64Encoding): string {
    return decode(input, encoding).toString();
  }
}
