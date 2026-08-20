import type { AesEncryptionRecord } from "@lindorm/aes";
import { AesError, AesKit } from "@lindorm/aes";
import type { KryptosEncryption, OctEncStdAlgorithm } from "@lindorm/kryptos";
import { KryptosKit, OCT_ENC_STD_ALGORITHMS } from "@lindorm/kryptos";
import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { expect } from "vitest";
import { Binding, Given, ParameterType, Then, When } from "../../../src/index.js";

/**
 * The M3 exit criterion's GREEN half: the full §3.1 feature on real
 * @lindorm/aes. Custom parameter types validate against the shipped kryptos
 * value lists — an unknown value throws, which is what makes the
 * conversion_failed run in the sibling aes-full-conversion-red fixture
 * reachable. The algorithm transform returns OctEncStdAlgorithm, not the
 * plan's KryptosEncAlgorithm: `KryptosKit.generate.enc.oct` accepts only oct
 * algorithms, so the wider union fails TS2322 at the call.
 */
@Binding()
export class AesContentEncryptionSteps {
  private kit!: AesKit;
  private encrypted!: string;
  private record!: AesEncryptionRecord;

  @Given('an oct key with algorithm "{algorithm}" and encryption "{encryption}"')
  anOctKey(algorithm: OctEncStdAlgorithm, encryption: KryptosEncryption): void {
    this.kit = new AesKit({
      kryptos: KryptosKit.generate.enc.oct({ algorithm, encryption }),
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

  @When('I encrypt {string} in record mode with aad "{aad}"')
  iEncryptInRecordMode(content: string, aad: Buffer): void {
    this.record = this.kit.encrypt(content, "record", { aad });
  }

  @Then('decrypting with aad "{aad}" returns {string}')
  decryptingWithAadReturns(aad: Buffer, expected: string): void {
    expect(this.kit.decrypt(this.record, { aad })).toBe(expected);
  }

  @Then('decrypting with aad "{aad}" is rejected')
  decryptingWithAadIsRejected(aad: Buffer): void {
    const decrypt = (): string => this.kit.decrypt(this.record, { aad });

    // The real wrong-AAD failure: the GCM auth check throws inside node
    // crypto and AesKit.decrypt wraps it (AesKit.ts catch: code
    // "decryption_failed", message "AES decryption failed").
    expect(decrypt).toThrow(AesError);
    expect(decrypt).toThrow("AES decryption failed");
  }

  @ParameterType("algorithm", /[A-Za-z0-9-]+/)
  static algorithm(raw: string): OctEncStdAlgorithm {
    const found = OCT_ENC_STD_ALGORITHMS.find((algorithm) => algorithm === raw);

    if (found) {
      return found;
    }

    throw new Error(`unknown oct key-wrap algorithm "${raw}"`);
  }

  @ParameterType("encryption", /[A-Za-z0-9-]+/)
  static encryption(raw: string): KryptosEncryption {
    const found = AES_ENCRYPTION_ALGORITHMS.find((encryption) => encryption === raw);

    if (found) {
      return found;
    }

    throw new Error(`unknown content encryption "${raw}"`);
  }

  @ParameterType("aad", /[A-Za-z0-9-]+/)
  static aad(raw: string): Buffer {
    return Buffer.from(raw, "utf8");
  }
}
