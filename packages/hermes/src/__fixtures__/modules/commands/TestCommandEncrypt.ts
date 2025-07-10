import { Command } from "../../../decorators";

@Command()
export class TestCommandEncrypt {
  public constructor(public readonly input: any) {}
}
