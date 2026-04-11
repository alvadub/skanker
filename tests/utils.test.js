import { describe, expect, it } from "bun:test";
import { clone, flatten, range, repeat, zip } from "../lib/utils.js";

describe("utils", () => {
  it("flattens one array level", () => {
    expect(flatten([[1, 2], [3], [4, 5]])).toEqual([1, 2, 3, 4, 5]);
  });

  it("repeats a value N times", () => {
    expect(repeat("x", 4)).toEqual(["x", "x", "x", "x"]);
  });

  it("builds inclusive ranges", () => {
    expect(range(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("supports stepped ranges by subdivision count", () => {
    expect(range(0, 1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("deep-clones nested arrays and objects", () => {
    const source = { a: [{ b: 1 }] };
    const copied = clone(source);
    copied.a[0].b = 2;
    expect(source.a[0].b).toBe(1);
  });

  it("zips shared indices only", () => {
    const output = [];
    zip([1, 2, 3], ["a", "b"], (left, right) => output.push([left, right]));
    expect(output).toEqual([[1, "a"], [2, "b"]]);
  });
});
