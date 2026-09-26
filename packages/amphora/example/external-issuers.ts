// setup(), addIssuer() and refresh() fetch over the network: each provider's
// discovery document, then its JWKS.
import { Amphora } from "../src/index.js";
import { Logger } from "@lindorm/logger";

const amphora = new Amphora({
  internal: { issuer: "https://auth.example.com" },
  idp: { issuer: "https://accounts.google.com" },
  external: [{ issuer: "https://token.actions.githubusercontent.com" }],
  logger: new Logger({ level: "warn", readable: true }),
  maxIssuers: 50,
  refreshInterval: 300_000,
  timeout: 10_000,
});

await amphora.setup();

const idp = amphora.idp.config();

console.log("idp issuer        > ", idp.issuer);
console.log("idp jwksUri       > ", idp.jwksUri);
console.log("idp authorization > ", idp.openIdConfiguration?.authorizationEndpoint);
console.log("idp keys          > ", idp.keyCount);

for (const config of amphora.external.issuers()) {
  console.log("external > ", config.issuer, config.keyCount, config.lastRefresh);
}

const foreign = await amphora.find({ use: "sig", internal: false });

console.log("foreign key > ", foreign.id, foreign.algorithm, foreign.issuer);

// A kid is unique only per issuer, so a scoped lookup never falls back.
const scoped = await amphora.findById(foreign.id, foreign.issuer!);

console.log("scoped findById > ", scoped.id);

await amphora.external.addIssuer({
  openIdConfigurationUri: "https://accounts.google.com/.well-known/openid-configuration",
});

await amphora.external.refresh("https://token.actions.githubusercontent.com");

console.log(
  "issuers > ",
  amphora.external.issuers().map((config) => config.issuer),
);

amphora.external.removeIssuer("https://token.actions.githubusercontent.com");

console.log("vault after eviction > ", amphora.vault.length);
