import { describe, it, expect } from "bun:test";
import {
  encodeHeader, decodeHeader,
  encodeScene, decodeScene,
  collectIndexed,
  normalizeBassEvents,
  TRACKS,
} from "../skt.js";

// --- helpers ---

function blankScene(overrides = {}) {
  return {
    name: "Scene 1",
    rhythm:  Array(32).fill(""),
    harmony: Array(32).fill(""),
    bass:    [],
    drums:   Object.fromEntries(TRACKS.map((t) => [t.key, Array(32).fill(0)])),
    mutes:   { rhythm: false, harmony: false, bass: false, drums: Object.fromEntries(TRACKS.map((t) => [t.key, false])) },
    trackVolumes: Object.fromEntries(TRACKS.map((t) => [t.key, t.volume])),
    ...overrides,
  };
}

// --- encodeHeader / decodeHeader ---

describe("encodeHeader / decodeHeader", () => {
  it("round-trips bpm", () => {
    const token = encodeHeader({ bpm: 120 });
    expect(decodeHeader(token).bpm).toBe(120);
  });

  it("round-trips song title", () => {
    const token = encodeHeader({ bpm: 80, songTitle: "RIDDIM" });
    expect(decodeHeader(token).songTitle).toBe("RIDDIM");
  });

  it("round-trips sound settings", () => {
    const token = encodeHeader({
      bpm: 80,
      sounds: { rhythm: "guitar", harmony: "guitar", drums: { kick: "standard", snare: "tr808", hihat: "standard", openhat: "jazz" } },
      bass: { preset: "custom" },
    });
    const h = decodeHeader(token);
    expect(h.sounds.rhythm).toBe("guitar");
    expect(h.sounds.harmony).toBe("guitar");
    expect(h.sounds.drums.kick).toBe("standard");
    expect(h.sounds.drums.snare).toBe("tr808");
    expect(h.bass.preset).toBe("custom");
  });

  it("round-trips volumes", () => {
    const token = encodeHeader({ bpm: 80, volumes: { master: 0.64, rhythm: 0.55, harmony: 0.54, drums: 0.67 }, bass: { volume: 0.4 } });
    const h = decodeHeader(token);
    expect(h.volumes.master).toBeCloseTo(0.64, 2);
    expect(h.volumes.rhythm).toBeCloseTo(0.55, 2);
    expect(h.bass.volume).toBeCloseTo(0.4, 2);
  });

  it("round-trips bass settings", () => {
    const token = encodeHeader({ bpm: 80, bass: { enabled: false, preset: "custom", octave: 2, filter: 360, glide: 0.2, release: 0.25 } });
    const h = decodeHeader(token);
    expect(h.bass.filter).toBeCloseTo(360, 0);
    expect(h.bass.glide).toBeCloseTo(0.2, 2);
    expect(h.bass.release).toBeCloseTo(0.25, 2);
  });

  it("omits k-token when sounds are all defaults", () => {
    const token = encodeHeader({ bpm: 100 });
    expect(token).not.toContain(",k");
  });

  it("omits m-token when mix is all defaults", () => {
    const token = encodeHeader({ bpm: 100 });
    expect(token).not.toContain(",m");
  });
});

// --- encodeScene / decodeScene ---

describe("encodeScene / decodeScene — blank scene", () => {
  it("round-trips blank scene", () => {
    const scene = blankScene();
    const token = encodeScene(scene, 0);
    const back  = decodeScene(token, 0);
    expect(back.rhythm).toEqual(scene.rhythm);
    expect(back.harmony).toEqual(scene.harmony);
    expect(back.mutes.rhythm).toBe(false);
  });

  it("blank drums produce compact tokens", () => {
    const token = encodeScene(blankScene(), 0);
    // all four drum tracks are empty → -!31 each (4 chars each, not 32)
    expect(token).toContain("-!31");
  });
});

describe("encodeScene / decodeScene — drum patterns", () => {
  it("round-trips reggae kick pattern", () => {
    const kick = Array(32).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0);
    const scene = blankScene({ drums: { ...Object.fromEntries(TRACKS.map((t) => [t.key, Array(32).fill(0)])), kick } });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    back.drums.kick.forEach((v, i) => {
      expect(v > 0).toBe(kick[i] > 0);
    });
  });

  it("uses tile compression for periodic kick", () => {
    const kick = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0];
    const scene = blankScene({ drums: { ...Object.fromEntries(TRACKS.map((t) => [t.key, Array(32).fill(0)])), kick } });
    expect(encodeScene(scene, 0)).toContain("(X---)8");
  });
});

describe("encodeScene / decodeScene — chord grid", () => {
  it("round-trips rhythm chords", () => {
    const rhythm = Array(32).fill("").map((_, i) => i % 4 === 2 ? "Dm" : "");
    rhythm[30] = "Ddim";
    const scene = blankScene({ rhythm });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    expect(back.rhythm[2]).toBe("Dm");
    expect(back.rhythm[30]).toBe("Ddim");
    expect(back.rhythm[0]).toBe("");
  });

  it("uses !N for rest runs in chord grid", () => {
    const rhythm = Array(32).fill("").map((_, i) => i % 4 === 2 ? "Dm" : "");
    const scene = blankScene({ rhythm });
    expect(encodeScene(scene, 0)).toContain("_!");
  });
});

describe("encodeScene / decodeScene — bass", () => {
  it("round-trips bass events", () => {
    const bass = [
      { tick: 0,  midi: 38, length: 8, velocity: 1 },
      { tick: 32, midi: 35, length: 4, velocity: 1 },
    ];
    const scene = blankScene({ bass });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    expect(back.bass).toHaveLength(2);
    expect(back.bass[0].midi).toBe(38);
    expect(back.bass[1].midi).toBe(35);
  });
});

describe("encodeScene / decodeScene — mutes", () => {
  it("round-trips mute flags", () => {
    const scene = blankScene({ mutes: { rhythm: true, harmony: false, bass: false, drums: Object.fromEntries(TRACKS.map((t) => [t.key, false])) } });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    expect(back.mutes.rhythm).toBe(true);
    expect(back.mutes.harmony).toBe(false);
  });

  it("round-trips drum mutes", () => {
    const scene = blankScene({ mutes: { rhythm: false, harmony: false, bass: false, drums: { kick: false, snare: false, hihat: true, openhat: false } } });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    expect(back.mutes.drums.hihat).toBe(true);
    expect(back.mutes.drums.kick).toBe(false);
  });
});

describe("encodeScene / decodeScene — custom name", () => {
  it("round-trips scene name", () => {
    const scene = blankScene({ name: "INTRO" });
    const back  = decodeScene(encodeScene(scene, 0), 0);
    expect(back.name).toBe("INTRO");
  });

  it("omits default scene name", () => {
    const token = encodeScene(blankScene({ name: "Scene 1" }), 0);
    expect(token).not.toContain(".n");
  });
});

// --- v1 → v2 migration ---

describe("v1 → v2 migration (RIDDIM)", () => {
  // First scene from real RIDDIM v1 payload
  const introScene = {
    name: "INTRO",
    rhythm:  Array(32).fill("").map((_, i) => i === 30 ? "Ddim" : i % 4 === 2 ? "Dm" : ""),
    harmony: Array(32).fill(""),
    bass: [
      { tick: 0,   midi: 38, length: 32, velocity: 1 },
      { tick: 32,  midi: 38, length: 16, velocity: 1 },
      { tick: 48,  midi: 35, length:  8, velocity: 1 },
      { tick: 56,  midi: 36, length:  8, velocity: 1 },
      { tick: 64,  midi: 38, length: 16, velocity: 1 },
      { tick: 80,  midi: 42, length: 16, velocity: 1 },
      { tick: 96,  midi: 38, length: 16, velocity: 1 },
      { tick: 112, midi: 35, length:  8, velocity: 1 },
      { tick: 120, midi: 36, length:  8, velocity: 1 },
    ],
    drums: {
      kick:    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      snare:   [0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0],
      hihat:   Array(32).fill(0),
      openhat: Array(32).fill(0),
    },
    mutes:       { rhythm: false, harmony: false, bass: false, drums: Object.fromEntries(TRACKS.map((t) => [t.key, false])) },
    trackVolumes: { kick: 1, snare: 0.75, hihat: 0.69, openhat: 0.55 },
  };

  it("encoded token is much shorter than raw JSON", () => {
    const token = encodeScene(introScene, 0);
    const rawJson = JSON.stringify(introScene);
    expect(token.length).toBeLessThan(rawJson.length / 3);
  });

  it("kick encodes with tile compression", () => {
    expect(encodeScene(introScene, 0)).toContain("(X---)8");
  });

  it("empty tracks encode to -!31", () => {
    expect(encodeScene(introScene, 0)).toContain("-!31");
  });

  it("round-trips all drum patterns losslessly", () => {
    const back = decodeScene(encodeScene(introScene, 0), 0);
    ["kick", "snare", "hihat", "openhat"].forEach((key) => {
      back.drums[key].forEach((v, i) => {
        expect(v > 0).toBe(introScene.drums[key][i] > 0);
      });
    });
  });

  it("round-trips chord grid including Ddim", () => {
    const back = decodeScene(encodeScene(introScene, 0), 0);
    expect(back.rhythm[2]).toBe("Dm");
    expect(back.rhythm[30]).toBe("Ddim");
  });

  it("encodes RIDDIM header correctly", () => {
    const state = {
      bpm: 80,
      songTitle: "RIDDIM",
      sounds: { rhythm: "guitar", harmony: "guitar", drums: { kick: "standard", snare: "tr808", hihat: "standard", openhat: "jazz" } },
      bass: { enabled: false, preset: "custom", octave: 2, volume: 0.4, filter: 360, glide: 0.2, release: 0.25 },
      volumes: { master: 0.64, rhythm: 0.55, harmony: 0.54, drums: 0.67 },
    };
    const token = encodeHeader(state);
    const h = decodeHeader(token);
    expect(h.bpm).toBe(80);
    expect(h.songTitle).toBe("RIDDIM");
    expect(h.sounds.rhythm).toBe("guitar");
    expect(h.sounds.drums.snare).toBe("tr808");
  });
});

// --- collectIndexed ---

describe("collectIndexed", () => {
  it("extracts indexed params in order", () => {
    const params = new URLSearchParams("s=header&s[0]=scene0&s[1]=scene1&s[2]=scene2");
    expect(collectIndexed(params, "s")).toEqual(["scene0", "scene1", "scene2"]);
  });

  it("ignores non-indexed params", () => {
    const params = new URLSearchParams("s=header&s[0]=scene0");
    expect(collectIndexed(params, "s")).toEqual(["scene0"]);
  });
});
