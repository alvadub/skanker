import { describe, expect, it } from "bun:test";
import { euclidean, parseEuclideanToken } from "../lib/euclidean.js";
import { transform } from "../lib/tokenize.js";

describe("euclidean", () => {
  it("builds classic euclidean patterns", () => {
    expect(euclidean(3, 8)).toBe("x--x--x-");
    expect(euclidean(5, 8)).toBe("x-x-xx-x");
    expect(euclidean(0, 8)).toBe("--------");
  });

  it("supports rotation", () => {
    expect(euclidean(3, 8, 2)).toBe("x-x--x--");
  });

  it("parses euclidean tokens", () => {
    expect(parseEuclideanToken("bd(3,8,1)")).toEqual({ onsets: 3, steps: 8, rotation: 1 });
    expect(parseEuclideanToken("x---")).toBeNull();
  });

  it("tokenizes shorthand into pattern tokens", () => {
    expect(transform("(3,8)")).toEqual([{ type: "pattern", value: "x--x--x-" }]);
    expect(transform("bd(3,8,1)")).toEqual([{ type: "pattern", value: "-x--x--x" }]);
  });
});
