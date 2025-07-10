import { Event } from "../../../src";

@Event()
export class ExampleEventEncrypt {
  public constructor(public readonly input: any) {}
}
