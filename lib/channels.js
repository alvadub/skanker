const DEFAULT_ALIASES = {
  drums: {
    bd: 2001,
    kick: 2001,
    sd: 2004,
    sn: 2004,
    snare: 2004,
    cp: 2028,
    clap: 2028,
    hh: 2035,
    hat: 2035,
    oh: 2081,
    ride: 2081,
    perc: 2123,
  },
  instruments: {
    piano: 0,
    epiano: 4,
    organ: 16,
    guitar: 24,
    bass: 33,
    strings: 48,
    brass: 61,
    lead: 80,
    pad: 88,
    choir: 52,
    fx: 98,
    synth: 94,
  },
};

function toChannelNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.charAt(0) === "#") {
    const n = parseInt(raw.slice(1), 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function normalizeAliasRows(rows = {}) {
  const out = {};
  Object.entries(rows || {}).forEach(([name, target]) => {
    const alias = String(name || "").toLowerCase().trim();
    if (!alias) return;
    const channel = toChannelNumber(target);
    if (!Number.isFinite(channel)) return;
    out[alias] = channel;
  });
  return out;
}

export function normalizeChannelAliases(raw = null) {
  const base = {
    drums: normalizeAliasRows(DEFAULT_ALIASES.drums),
    instruments: normalizeAliasRows(DEFAULT_ALIASES.instruments),
  };
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      all: { ...base.drums, ...base.instruments },
    };
  }

  const nextDrums = {
    ...base.drums,
    ...normalizeAliasRows(raw.drums),
  };
  const nextInstruments = {
    ...base.instruments,
    ...normalizeAliasRows(raw.instruments),
  };
  return {
    drums: nextDrums,
    instruments: nextInstruments,
    all: {
      ...nextDrums,
      ...nextInstruments,
    },
  };
}

export function resolveChannelToken(value, channelAliases = null) {
  const token = String(value || "").trim();
  if (!token || token.charAt(0) !== "#") return token;
  const raw = token.slice(1).trim();
  if (!raw) throw new TypeError(`Missing channel value in '${token}'`);

  const numeric = toChannelNumber(raw);
  if (Number.isFinite(numeric) && /^\d+$/.test(raw)) return `#${numeric}`;

  const aliases = normalizeChannelAliases(channelAliases);
  const target = aliases.all[String(raw).toLowerCase()];
  if (Number.isFinite(target)) return `#${target}`;

  throw new TypeError(`Unknown channel alias '#${raw}'`);
}

export const DEFAULT_CHANNEL_ALIASES = normalizeChannelAliases();
