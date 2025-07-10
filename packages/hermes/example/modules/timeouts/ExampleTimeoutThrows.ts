import { Timeout } from "../../../src";

@Timeout()
export class ExampleTimeoutThrows {
  public constructor(public readonly input: any) {}
}
