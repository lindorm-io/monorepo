import { Event } from "../../../src";

@Event()
export class ExampleEventDestroy {
  public constructor(public readonly input: any) {}
}
