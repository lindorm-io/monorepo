import { Command } from "../../../src";

@Command()
export class ExampleCommandCreate {
  public constructor(public readonly input: any) {}
}
