import assert from "node:assert/strict";
import { test } from "node:test";

import { getNextDistDir } from "../scripts/next-dist-dir.mjs";

test("Next development and production servers use isolated build output", () => {
  const developmentDir = getNextDistDir({ NODE_ENV: "development" });
  const productionDir = getNextDistDir({ NODE_ENV: "production" });

  assert.equal(developmentDir, ".next-dev");
  assert.equal(productionDir, ".next");
  assert.notEqual(developmentDir, productionDir);
});

test("NEXT_DIST_DIR overrides the environment default", () => {
  assert.equal(getNextDistDir({ NODE_ENV: "development", NEXT_DIST_DIR: ".next-custom" }), ".next-custom");
});
