const base = require("../../jest.config.integration.base");
const packageJson = require("./package");

module.exports = {
  ...base,
  displayName: packageJson.name,
};
