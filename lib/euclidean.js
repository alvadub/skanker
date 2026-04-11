export function euclidean(onsets, steps, rotation = 0) {
  const k = Math.max(0, parseInt(onsets, 10) || 0);
  const n = Math.max(1, parseInt(steps, 10) || 1);
  if (k <= 0) return "-".repeat(n);
  if (k >= n) return "x".repeat(n);

  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(((i * k) % n) < k ? "x" : "-");
  }
  const r = ((parseInt(rotation, 10) || 0) % n + n) % n;
  if (r === 0) return out.join("");
  return out.slice(-r).concat(out.slice(0, -r)).join("");
}

export function parseEuclideanToken(token) {
  const m = String(token || "").match(/^(?:[a-zA-Z_]\w*)?\((\d+)\s*,\s*(\d+)(?:\s*,\s*(-?\d+))?\)$/);
  if (!m) return null;
  return {
    onsets: parseInt(m[1], 10),
    steps: parseInt(m[2], 10),
    rotation: m[3] ? parseInt(m[3], 10) : 0,
  };
}
