import { Command } from "../../../src";

@Command()
export class ExampleCommandEncrypt {
  public constructor(public readonly input: any) {}
}
