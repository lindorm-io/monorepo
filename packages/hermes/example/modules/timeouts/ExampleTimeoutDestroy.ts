import { Timeout } from "../../../src";

@Timeout()
export class ExampleTimeoutDestroy {
  public constructor(public readonly input: any) {}
}
