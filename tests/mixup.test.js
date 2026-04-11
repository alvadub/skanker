import { describe, expect, it } from "bun:test";
import { parse, reduce } from "../lib/parser.js";
import { merge, pack } from "../lib/mixup.js";

describe("mixup pack/reduce", () => {
  it("resolves durations", () => {
    const input = [{ type: "pattern", value: "[1]--x" }];

    expect(reduce(input, {}, pack([120], ["c3", "c4"]))).toEqual([[
      [{ l: "1", v: 120, n: "c3" }],
      { v: 0 },
      { v: 0 },
      { v: 120, n: "c4" },
    ]]);
  });

  it("honors sustain with _ and rest with -", () => {
    const input = [{ type: "pattern", value: "x_--x" }];
    expect(reduce(input, {}, pack([90, 100], ["c3", "d3"]))).toEqual([[
      { v: 90, n: "c3" },
      { v: 0, h: 1 },
      { v: 0 },
      { v: 0 },
      { v: 100, n: "d3" },
    ]]);
  });

  it("cycles note and velocity consumption", () => {
    const input = [{ type: "pattern", value: "x-x-x-" }];
    expect(reduce(input, {}, pack([70, 90], ["c3"]))).toEqual([[
      { v: 70, n: "c3" },
      { v: 0 },
      { v: 90, n: "c3" },
      { v: 0 },
      { v: 70, n: "c3" },
      { v: 0 },
    ]]);
  });
});

describe("mixup merge", () => {
  it("composes simple tracks", () => {
    expect(merge(parse(`
      # track
      #1 -x
    `))).toEqual([
      [[["1", "track", [{ v: 0 }, { v: 127 }]]]],
    ]);

    expect(merge(parse(`
      # track
      #1 125 ---x
    `))).toEqual([
      [[["1", "track", [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 125 }]]]],
    ]);
  });

  it("layers clips with + and keeps replace semantics for repeated !", () => {
    const layered = merge(parse(`
      # hats
        @A
          #2035 ! 70 x-x-
          #2035 + 90 --x-
      > A
    `))[0][0][0][2];

    expect(layered).toEqual([
      { v: 70 },
      { v: 0 },
      { v: 90 },
      { v: 0 },
    ]);

    const replaced = merge(parse(`
      # hats
        @A
          #2035 ! 70 x-x-
          #2035 ! 90 --x-
      > A
    `))[0][0][0][2];

    expect(replaced).toEqual([
      { v: 0 },
      { v: 0 },
      { v: 90 },
      { v: 0 },
    ]);
  });

  it("keeps note overrides on inherited sections", () => {
    const midi = merge(parse(`
      %a C4 D4
      %b E4 F4

      # lead
        @A
          #1 x-x- %a
        @B < A
          #1 %b

      > A B
    `));

    const sectionA = midi[0][0][0][2].filter((t) => t.v > 0).map((t) => t.n);
    const sectionB = midi[0][1][0][2].filter((t) => t.v > 0).map((t) => t.n);

    expect(sectionA).toEqual(["C4", "D4"]);
    expect(sectionB).toEqual(["E4", "F4"]);
  });

  it("preserves sustain slots for notes and chords", () => {
    const notes = merge(parse(`
      # melody
        @A
          #0 77 x___x--- D5 D4
      > A
    `))[0][0][0][2];

    expect(notes.slice(0, 8)).toEqual([
      { v: 77, n: "D5" },
      { v: 0, h: 1 },
      { v: 0, h: 1 },
      { v: 0, h: 1 },
      { v: 77, n: "D4" },
      { v: 0 },
      { v: 0 },
      { v: 0 },
    ]);

    const chords = merge(parse(`
      # chords
        @A
          #0 77 x___x--- D3|A3|D5 G3|B3|G4
      > A
    `))[0][0][0][2];

    expect(chords.slice(0, 8)).toEqual([
      { v: 77, n: ["D3", "A3", "D5"] },
      { v: 0, h: 1 },
      { v: 0, h: 1 },
      { v: 0, h: 1 },
      { v: 77, n: ["G3", "B3", "G4"] },
      { v: 0 },
      { v: 0 },
      { v: 0 },
    ]);
  });
});
