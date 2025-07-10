import { Command } from "../../../decorators";

@Command()
export class TestCommandTimeout {
  public constructor(public readonly input: any) {}
}
