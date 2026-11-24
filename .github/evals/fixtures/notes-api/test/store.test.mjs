import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { add, list, reset } from "../src/store.mjs";

beforeEach(reset);

test("add returns increasing ids", () => {
  assert.equal(add("a"), 1);
  assert.equal(add("b"), 2);
});

test("list returns every note", () => {
  add("a");
  assert.deepEqual(list(), [{ id: 1, text: "a" }]);
});
