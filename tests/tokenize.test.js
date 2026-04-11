import { describe, expect, it } from "bun:test";
import { inlineChord } from "harmonics";
import {
  isChord,
  isNote,
  split,
  transform,
} from "../lib/tokenize.js";

function tok(type, value, extra = {}) {
  return { type, value, ...extra };
}

describe("tokenize", () => {
  it("handles basic syntax errors", () => {
    expect(() => transform()).toThrow();
    expect(() => transform("")).toThrow();
    expect(() => transform("*")).toThrow("Deprecated repeat syntax");
    expect(() => transform("x / 2")).toThrow();
    expect(() => transform("0..10")).toThrow("Slice start must be >= 1");
  });

  it("builds an AST from common expressions", () => {
    expect(transform("x")).toEqual([tok("pattern", "x")]);
    expect(transform("#3 x-xx")).toEqual([tok("channel", "#3"), tok("pattern", "x-xx")]);
    expect(transform("x-xx x2")).toEqual([tok("pattern", "x-xx"), tok("multiply", 2)]);
    expect(transform("x /2")).toEqual([tok("pattern", "x"), tok("divide", 2)]);
    expect(transform("C4 major ++ I IV V")).toEqual([
      tok("note", "C4"),
      tok("mode", "major"),
      tok("progression", "I IV V"),
    ]);
    expect(transform("C4 minor ** 1 3 5")).toEqual([
      tok("note", "C4"),
      tok("mode", "minor"),
      tok("degrees", ["1", "3", "5"]),
    ]);
    expect(transform("1..10 x3 /2")).toEqual([
      tok("slice", [1, 10]),
      tok("multiply", 3),
      tok("divide", 2),
    ]);
  });

  it("preserves bracket substeps when splitting patterns", () => {
    expect(split("xxxxxxx[xx]")).toEqual([
      "x", "x", "x", "x", "x", "x", "x", ["x", "x"],
    ]);
  });

  it("recognizes notes and chord names consistently", () => {
    expect(isNote("c")).toBeFalse();
    expect(isNote("c3")).toBeTrue();
    expect(isChord("c")).toBeTrue();
    expect(isChord("C4 major")).toBeFalse();
  });

  it("expands scribble chords through harmonics", () => {
    expect(transform("C")).toEqual([tok("chord", ["C4", "E4", "G4"])]);
    expect(transform("Cm")).toEqual([tok("chord", ["C4", "Eb4", "G4"])]);
    expect(transform("Cmaj7")).toEqual([tok("chord", ["C4", "E4", "G4", "B4"])]);
    expect(transform("Dm...")).toEqual([tok("chord", inlineChord("Dm"), { unfold: true })]);
  });

  it("handles placeholders and pattern references", () => {
    expect(transform("g3 x7 f2 %")).toEqual([
      tok("note", "g3"),
      tok("multiply", 7),
      tok("note", "f2", { repeat: 2 }),
    ]);
    expect(transform("%Am % % %")).toEqual([tok("param", "%Am", { repeat: 4 })]);
    expect(transform("&kick %")).toEqual([tok("pattern_ref", "&kick", { repeat: 2 })]);
  });
});
