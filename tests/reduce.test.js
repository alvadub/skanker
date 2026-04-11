import { describe, expect, it } from "bun:test";
import { reduce } from "../lib/parser.js";

describe("reduce", () => {
  const context = {
    "%a": "a2",
    "%x": ["%a", ["a2", "b2"]],
    "%Am": [["a3", "c4", "e3"]],
    "%Cm": ["c3", "d#3", "g3"],
  };

  it("resolves notes with multiply and repeat", () => {
    expect(reduce([
      { type: "note", value: "g1" },
      { type: "multiply", value: 7 },
      { type: "note", value: "f1", repeat: 2 },
    ], context)).toEqual(["g1", "g1", "g1", "g1", "g1", "g1", "g1", "f1", "f1"]);
  });

  it("resolves param references from context", () => {
    expect(reduce([
      { type: "param", value: "%Am" },
      { type: "param", value: "%x" },
    ], context)).toEqual([
      context["%Am"][0],
      "%a",
      ["a2", "b2"],
    ]);
  });

  it("handles unfolded chord slice chain in current reducer", () => {
    expect(reduce([
      { type: "chord", value: ["F3", "Ab3", "C4"], unfold: true },
      { type: "slice", value: [0, 2] },
      { type: "note", value: "d3" },
    ], context)).toEqual(["F3", "Ab3", "C4", [0, 2], "d3"]);
  });

  it("resolves progression expressions with ++ fragments", () => {
    expect(reduce([
      { type: "note", value: "C4" },
      { type: "mode", value: "major" },
      { type: "progression", value: "I IV V" },
    ], context)).toEqual([
      [
        ["C4", "E4", "G4"],
        ["F4", "A4", "C5"],
        ["G4", "B4", "D5"],
      ],
    ]);
  });

  it("throws on invalid ... ++ combination", () => {
    expect(() => reduce([
      { type: "note", value: "D4" },
      { type: "mode", value: "minor..." },
      { type: "progression", value: "I IV V ii" },
    ], context)).toThrow("Use either '...' (expand scale) or '++' (progression), not both");
  });

  it("resolves degree selection expressions with **", () => {
    expect(reduce([
      { type: "note", value: "C4" },
      { type: "mode", value: "minor" },
      { type: "degrees", value: ["1", "3", "5"] },
    ], context)).toEqual([
      ["C4", "Eb4", "G4"],
    ]);
  });
});
