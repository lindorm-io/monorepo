const base = require("../../jest.config.e2e.base");
const packageJson = require("./package");

module.exports = {
  ...base,
  displayName: packageJson.name,
};
