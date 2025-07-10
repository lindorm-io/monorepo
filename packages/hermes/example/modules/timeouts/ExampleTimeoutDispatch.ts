import { Timeout } from "../../../src";

@Timeout()
export class ExampleTimeoutDispatch {
  public constructor(public readonly input: any) {}
}
