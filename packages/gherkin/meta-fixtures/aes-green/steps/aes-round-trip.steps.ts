import { AesKit } from "@lindorm/aes";
import type { KryptosEncryption, OctEncStdAlgorithm } from "@lindorm/kryptos";
import { KryptosKit } from "@lindorm/kryptos";
import { expect } from "vitest";
import { Binding, Given, Then, When } from "../../../src/index.js";

/**
 * The M1 exit criterion's GREEN half: real @lindorm/aes round trips driven by
 * the §7 {string}-only feature — algorithm and encryption arrive as plain
 * strings and are cast at the call site.
 */
@Binding()
export class AesRoundTripSteps {
  private kit!: AesKit;
  private encrypted!: string;

  @Given("an oct key with algorithm {string} and encryption {string}")
  anOctKeyWithAlgorithmAndEncryption(algorithm: string, encryption: string): void {
    this.kit = new AesKit({
      kryptos: KryptosKit.generate.enc.oct({
        algorithm: algorithm as OctEncStdAlgorithm,
        encryption: encryption as KryptosEncryption,
      }),
    });
  }

  @When("I encrypt {string}")
  iEncrypt(content: string): void {
    this.encrypted = this.kit.encrypt(content);
  }

  @Then("decrypting returns {string}")
  decryptingReturns(expected: string): void {
    expect(this.kit.decrypt(this.encrypted)).toBe(expected);
  }
}
