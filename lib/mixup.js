import midiWriter from "midi-writer-js";
import { reduce } from "./parser.js";
import { split, isPattern } from "./tokenize.js";
import { flatten } from "./utils.js";

const { Track, NoteOnEvent, ProgramChangeEvent, TempoEvent } = midiWriter;

const DEFAULT = Symbol("@main");

function mergeNotePayload(a, b) {
  const aa = Array.isArray(a) ? a : (a ? [a] : []);
  const bb = Array.isArray(b) ? b : (b ? [b] : []);
  const out = [];

  aa.concat(bb).forEach((note) => {
    if (typeof note === "undefined" || note === null) return;
    if (!out.includes(note)) out.push(note);
  });

  if (out.length === 0) return undefined;
  if (out.length === 1) return out[0];
  return out;
}

function mergeTicks(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (Array.isArray(left) && Array.isArray(right)) {
      const max = Math.max(left.length, right.length);
      const out = [];

      for (let i = 0; i < max; i += 1) {
        out.push(mergeTicks(left[i], right[i]));
      }
      return out;
    }

    return typeof right !== "undefined" ? right : left;
  }

  if (!left) return right;
  if (!right) return left;

  const lv = left.v || 0;
  const rv = right.v || 0;
  const hitLeft = lv > 0;
  const hitRight = rv > 0;

  if (!hitLeft && hitRight) return { ...right };
  if (hitLeft && !hitRight) return { ...left };

  if (!hitLeft && !hitRight) {
    return (left.h || right.h) ? { v: 0, h: 1 } : { v: 0 };
  }

  const out = {
    ...left,
    ...right,
    v: Math.max(lv, rv),
  };
  const note = mergeNotePayload(left.n, right.n);
  if (typeof note !== "undefined") out.n = note;
  return out;
}

function mergeTickLayers(base, top) {
  const max = Math.max(base.length, top.length);
  const out = [];

  for (let i = 0; i < max; i += 1) {
    out.push(mergeTicks(base[i], top[i]));
  }
  return out;
}

export function build(midi, bpm = 120, length = 16) {
  const tracks = [];
  const q = 16;
  const o = {};

  let ch = 0;
  function get(nth, name) {
    const key = nth + name;

    if (!get[key]) {
      const track = new Track();
      const chan = nth === "0" ? 9 : ch;

      tracks.push(track);
      get[key] = { chan, track };
      if (nth !== "0") ch += 1;
    }
    return get[key];
  }

  midi.forEach((section) => {
    section.forEach((parts) => {
      parts.forEach((e) => {
        const { chan, track } = get(e[0], e[1]);

        track.addEvent(new TempoEvent({ bpm }));

        if (chan !== 9) {
          track.addEvent(new ProgramChangeEvent({
            channel: chan,
            instrument: parseInt(e[0], 10) || 0,
          }));
        }

        for (let i = 0; i < e[2].length; i += 1) {
          const tick = e[2][i];

          if (tick.v > 0) {
            const note = tick.n || "C3";

            track.addEvent(new NoteOnEvent({
              channel: chan,
              pitch: note,
              duration: "8",
              velocity: tick.v,
            }));
          }
        }
      });
    });
  });

  void q;
  void o;
  void length;
  const writer = new midiWriter.Writer(tracks);
  return writer.toBuffer();
}

export function pack(values, notes) {
  let offset;
  function cyclical(list, index) {
    if (!Array.isArray(list) || !list.length) return undefined;
    const pos = ((index % list.length) + list.length) % list.length;
    return list[pos];
  }

  function resolve(x) {
    if (Array.isArray(x)) {
      return x.map(resolve);
    }

    if (typeof x === "string" && x.length > 1 && /[x_\-\[\]]/.test(x)) {
      const parts = split(x);
      if (Array.isArray(parts) && parts.length > 1) {
        return parts.map(resolve);
      }
    }

    let token;
    if (!"-x_".includes(x)) {
      token = { v: 127, l: x };
      const velocity = cyclical(values, offset);
      token.v = typeof velocity !== "undefined" ? velocity : token.v || 0;
      const note = cyclical(notes, offset);
      if (typeof note !== "undefined") token.n = note;
      if (values.length === 1) token.v = values[0];
      if (token.v || token.n) offset += 1;
      return token;
    }

    if (x === "-") {
      return { v: 0 };
    }

    if (x === "_") {
      return { v: 0, h: 1 };
    }

    token = { v: 127 };
    const velocity = cyclical(values, offset);
    token.v = typeof velocity !== "undefined" ? velocity : token.v || 0;
    const note = cyclical(notes, offset);
    if (typeof note !== "undefined") token.n = note;
    if (values.length === 1) token.v = values[0];
    if (token.v || token.n) offset += 1;
    return token;
  }

  return (value) => {
    let result = value;
    if (typeof value === "string") {
      if (isPattern(value)) {
        offset = 0;
        result = split(value).map(resolve);
      }
    }
    return result;
  };
}

export function merge(ctx) {
  const scenes = {};

  Object.entries(ctx.tracks).forEach(([name, channels]) => {
    Object.entries(channels).forEach(([ch, clips]) => {
      const [tag, midi] = ch.split("#");
      const key = tag || DEFAULT;

      let ticks;
      clips.forEach((clip) => {
        const values = clip.values ? reduce(clip.values, ctx.data) : [];
        const notes = clip.data ? reduce(clip.data, ctx.data) : [];

        if (clip.input) {
          if (values.length > 1) values.shift();

          const input = flatten(reduce(clip.input, ctx.data, pack(values, notes)));
          const mode = clip.values
            && clip.values[0]
            && clip.values[0].type === "mode" ? clip.values[0].value : null;

          input.forEach((tick) => {
            if (tick.v > 0) {
              if (mode && values.length > 0) tick[mode[0].toLowerCase()] = values.shift();
            }
          });

          if (clip.merge === "layer" && ticks) {
            ticks = mergeTickLayers(ticks, input);
          } else {
            ticks = input;
          }
        } else if (ticks) {
          const mode = clip.values
            && clip.values[0]
            && clip.values[0].type === "mode" ? clip.values[0].value : null;

          ticks.forEach((tick) => {
            if (tick.v > 0) {
              if (mode && values.length > 0) tick[mode[0].toLowerCase()] = values.shift();
            }
          });
        }
      });

      if (!scenes[key]) scenes[key] = { tracks: [] };
      scenes[key].tracks.push([midi, name, ticks]);
    });
  });

  if (!ctx.main.length) {
    ctx.main = [[{ type: "value", value: DEFAULT }]];
  }

  return ctx.main.map((track) => {
    return reduce(track, scenes).map((item) => {
      return [].concat(item).reduce((memo, x) => {
        memo.push(...x.tracks);
        return memo;
      }, []);
    });
  });
}
