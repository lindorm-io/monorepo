import { Timeout } from "../../../src";

@Timeout()
export class ExampleTimeoutSetState {
  public constructor(public readonly input: any) {}
}
