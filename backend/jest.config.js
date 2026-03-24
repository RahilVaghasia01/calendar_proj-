/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // One worker so each test file can set WIZZ_JSON_PATH without races
  maxWorkers: 1,
  clearMocks: true,
};
