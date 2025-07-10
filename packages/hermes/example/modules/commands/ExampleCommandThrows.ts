import { Command } from "../../../src";

@Command()
export class ExampleCommandThrows {
  public constructor(public readonly input: any) {}
}
