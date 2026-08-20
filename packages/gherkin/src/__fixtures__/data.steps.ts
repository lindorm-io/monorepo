import { expect } from "vitest";
import { z } from "zod";
import type { DataTable, DocString } from "../index.js";
import { Binding, Given, Then } from "../index.js";

const ProductSchema = z.object({ name: z.string(), price: z.coerce.number() });

type Product = z.output<typeof ProductSchema>;

/**
 * Step definitions for the in-package data run (data.feature) — the proof
 * that DataTable/DocString travel plugin → model → runtime → trailing slot
 * in-process, zod conversion included. Loaded via the plugin's step glob.
 */
@Binding()
export class DataSteps {
  private payload!: DocString;
  private product!: Product;
  private products!: Array<Product>;

  @Given("the catalog")
  theCatalog(table: DataTable): void {
    this.products = table.createSet(ProductSchema);
  }

  @Then("the total price is {string}")
  theTotalPriceIs(total: string): void {
    expect(this.products.reduce((sum, product) => sum + product.price, 0)).toBe(
      Number(total),
    );
  }

  @Given("the product")
  theProduct(table: DataTable): void {
    this.product = table.create(ProductSchema);
  }

  @Then("the product costs {string}")
  theProductCosts(price: string): void {
    expect(this.product.price).toBe(Number(price));
  }

  @Given("the payload")
  thePayload(doc: DocString): void {
    this.payload = doc;
  }

  @Then("the payload notes {string} as {string}")
  thePayloadNotes(note: string, mediaType: string): void {
    expect(JSON.parse(this.payload.content)).toEqual({ note });
    expect(this.payload.mediaType).toBe(mediaType);
  }
}
