const base = require("../../jest.config.integration.base");
const packageJson = require("./package");

module.exports = {
  ...base,
  name: packageJson.name,
  displayName: packageJson.name,
};
