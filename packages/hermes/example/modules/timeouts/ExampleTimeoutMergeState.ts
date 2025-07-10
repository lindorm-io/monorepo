import { Timeout } from "../../../src";

@Timeout()
export class ExampleTimeoutMergeState {
  public constructor(public readonly input: any) {}
}
