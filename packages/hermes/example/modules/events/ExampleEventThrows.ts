import { Event } from "../../../src";

@Event()
export class ExampleEventThrows {
  public constructor(public readonly input: any) {}
}
