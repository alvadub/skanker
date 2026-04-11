export function flatten(value) {
  return value.reduce((prev, cur) => prev.concat(cur), []);
}

export function repeat(value, times) {
  const out = [];

  while (times) {
    out.push(value);
    times -= 1;
  }

  return out;
}

export function range(min, max, step) {
  const acc = [];

  if (!step) {
    for (let i = min; i <= max; i += 1) {
      acc.push(i);
    }
  } else {
    const diff = (max - min) / step;

    for (let i = min; i <= max; i += diff) {
      acc.push(i);
    }
  }

  return acc;
}

export function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);

  const copy = {};

  Object.keys(value).forEach((key) => {
    copy[key] = clone(value[key]);
  });

  return copy;
}

export function zip(a, b, cb) {
  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max; i += 1) {
    if (typeof a[i] !== "undefined" && typeof b[i] !== "undefined") cb(a[i], b[i]);
  }
}
