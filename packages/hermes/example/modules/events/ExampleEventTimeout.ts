import { Event } from "../../../src";

@Event()
export class ExampleEventTimeout {
  public constructor(public readonly input: any) {}
}
