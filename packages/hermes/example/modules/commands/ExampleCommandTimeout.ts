import { Command } from "../../../src";

@Command()
export class ExampleCommandTimeout {
  public constructor(public readonly input: any) {}
}
