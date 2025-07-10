import { Event } from "../../../src";

@Event()
export class ExampleEventDestroyNext {
  public constructor(public readonly input: any) {}
}
