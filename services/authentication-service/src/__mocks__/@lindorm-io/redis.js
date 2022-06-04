const { createMockCache } = require("@lindorm-io/redis");
const redis = jest.createMockFromModule("@lindorm-io/redis");

module.exports = { ...redis, createMockCache };
