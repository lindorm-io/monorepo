import { Event } from "../../../src";

@Event()
export class ExampleEventCreate {
  public constructor(public readonly input: any) {}
}
