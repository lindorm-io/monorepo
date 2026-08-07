import type { Answers } from "./types.js";

/**
 * `src/pylon/amphora.ts` — the key vault, and the ONLY place an issuer is
 * declared.
 *
 * Amphora owns all three issuer scopes: `issuer` is this service's own
 * (`amphora.internal`), `idp` is the single upstream, and `external` is any
 * foreign peer. Pylon's auth driver declares none of them — it reads whichever
 * scope it pins off this instance, so which upstream the service talks to is
 * stated once, here.
 */
export const buildAmphoraFile = (answers: Answers): string => {
  const lines: Array<string> = [
    `import { Amphora } from "@lindorm/amphora";`,
    `import { logger } from "../logger/index.js";`,
    `import { config } from "./config.js";`,
    ``,
    `// \`issuer\` is this service's own identity: every key added to the vault (the`,
    `// KEK below, plus rotated Kryptos keys) derives its issuer + jwks_uri from it,`,
    `// and it's what /.well-known/jwks.json publishes under. \`environment\` rejects`,
    `// any key whose certificate was minted for a different deployment environment.`,
  ];

  if (answers.features.auth) {
    lines.push(
      `//`,
      `// \`idp\` is the UPSTREAM identity provider — registered here and nowhere else.`,
      `// Amphora discovers \`{issuer}/.well-known/openid-configuration\` and fetches the`,
      `// provider's keys from it; \`OpenIdDriver\` then reads that document rather than`,
      `// fetching anything itself. Registration is lazy, and \`pylon.setup()\` awaits`,
      `// \`amphora.setup()\`, so the document is resolved before the first request.`,
    );
  }

  lines.push(
    `export const amphora = new Amphora({`,
    `  logger,`,
    `  issuer: config.issuer,`,
    `  environment: config.nodeEnv,`,
  );

  if (answers.features.auth) {
    lines.push(`  idp: { issuer: config.auth.issuer },`);
  }

  lines.push(`});`, ``, `amphora.env(config.pylon.kek);`, ``);

  return lines.join("\n");
};
