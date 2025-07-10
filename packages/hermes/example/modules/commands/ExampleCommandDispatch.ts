import { Command } from "../../../src";

@Command()
export class ExampleCommandDispatch {
  public constructor(public readonly input: any) {}
}
