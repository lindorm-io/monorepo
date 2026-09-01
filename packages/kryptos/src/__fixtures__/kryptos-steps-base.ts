import { AbstractSteps, Inject } from "@lindorm/gherkin";
import { expect } from "vitest";
import { KryptosError } from "../errors/index.js";
import { KryptosContext } from "./kryptos-context.js";

export type KeyFormat = "b64" | "der" | "jwk" | "pem";

export type Subject = "kryptos" | "other";

@AbstractSteps()
export abstract class KryptosStepsBase {
  @Inject(KryptosContext) protected readonly ctx!: KryptosContext;

  protected refused(code: string, act: () => unknown): void {
    let caught: unknown;

    try {
      act();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(KryptosError);
    expect(caught).toMatchObject({ code });
  }

  protected unwrapPem(pem: string): string {
    return pem
      .replace("-----BEGIN CERTIFICATE-----", "")
      .replace("-----END CERTIFICATE-----", "")
      .replace(/\s/g, "");
  }
}
