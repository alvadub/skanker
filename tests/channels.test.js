import { describe, expect, it } from "bun:test";
import {
  DEFAULT_CHANNEL_ALIASES,
  normalizeChannelAliases,
  resolveChannelToken,
} from "../lib/channels.js";

describe("channels", () => {
  it("exposes normalized default aliases", () => {
    expect(DEFAULT_CHANNEL_ALIASES.drums.bd).toBe(2001);
    expect(DEFAULT_CHANNEL_ALIASES.instruments.piano).toBe(0);
    expect(DEFAULT_CHANNEL_ALIASES.all.hh).toBe(2035);
  });

  it("merges custom aliases on top of defaults", () => {
    const aliases = normalizeChannelAliases({
      drums: { rim: "#42" },
      instruments: { keys: 7 },
    });

    expect(aliases.drums.rim).toBe(42);
    expect(aliases.instruments.keys).toBe(7);
    expect(aliases.all.kick).toBe(2001);
  });

  it("resolves numeric channels and aliases", () => {
    expect(resolveChannelToken("#3")).toBe("#3");
    expect(resolveChannelToken("#bd")).toBe("#2001");
    expect(resolveChannelToken("#piano")).toBe("#0");
  });

  it("resolves custom aliases case-insensitively", () => {
    expect(resolveChannelToken("#Rim", { drums: { rim: 42 } })).toBe("#42");
  });

  it("throws for invalid alias tokens", () => {
    expect(() => resolveChannelToken("#")).toThrow("Missing channel value");
    expect(() => resolveChannelToken("#drumz")).toThrow("Unknown channel alias '#drumz'");
  });
});
