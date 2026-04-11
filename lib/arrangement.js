const RE_SECTION = /^[A-Z][A-Z0-9]*$/;
const RE_REPEAT = /^x(\d+)$/;

function isSection(value) {
  return RE_SECTION.test(String(value || ""));
}

function parseRepeat(value) {
  const m = String(value || "").match(RE_REPEAT);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, n);
}

function lex(body) {
  return (String(body || "").match(/\[|\]|[^\s\[\]]+/g) || [])
    .map((text, idx) => ({
      text,
      index: idx,
      order: -1,
      kind: "unknown",
      blockId: null,
      blockLive: false,
      blockStartOrder: null,
      blockEndOrder: null,
    }));
}

function applyBlockMeta(token, blockMeta) {
  if (!token || !blockMeta) return;
  token.blockId = blockMeta.id;
  token.blockLive = Boolean(blockMeta.live);
  token.blockStartOrder = blockMeta.startOrder;
  token.blockEndOrder = blockMeta.endOrder;
}

function parseSimpleRange(tokens, start, end, state, blockMeta, expanded) {
  let i = start;
  while (i < end) {
    const token = tokens[i];
    if (!token) break;
    applyBlockMeta(token, blockMeta);

    if (token.text === "[" || token.text === "]") {
      token.kind = token.text === "[" ? "block-open" : "block-close";
      i += 1;
      continue;
    }

    if (isSection(token.text)) {
      token.kind = "section";
      state.lastName = token.text;
      expanded.push({
        name: token.text,
        displayOrder: token.order,
        blockId: blockMeta ? blockMeta.id : null,
        blockLive: blockMeta ? Boolean(blockMeta.live) : false,
        blockStartOrder: blockMeta ? blockMeta.startOrder : null,
        blockEndOrder: blockMeta ? blockMeta.endOrder : null,
      });
      i += 1;
      continue;
    }

    if (token.text === "%" && state.lastName) {
      token.kind = "repeat-last";
      expanded.push({
        name: state.lastName,
        displayOrder: token.order,
        blockId: blockMeta ? blockMeta.id : null,
        blockLive: blockMeta ? Boolean(blockMeta.live) : false,
        blockStartOrder: blockMeta ? blockMeta.startOrder : null,
        blockEndOrder: blockMeta ? blockMeta.endOrder : null,
      });
      i += 1;
      continue;
    }

    const repeat = parseRepeat(token.text);
    if (repeat && state.lastName) {
      token.kind = "repeat";
      for (let k = 1; k < repeat; k += 1) {
        expanded.push({
          name: state.lastName,
          displayOrder: token.order,
          blockId: blockMeta ? blockMeta.id : null,
          blockLive: blockMeta ? Boolean(blockMeta.live) : false,
          blockStartOrder: blockMeta ? blockMeta.startOrder : null,
          blockEndOrder: blockMeta ? blockMeta.endOrder : null,
        });
      }
      i += 1;
      continue;
    }

    token.kind = "unknown";
    i += 1;
  }
}

export function parseArrangementBody(body, options = {}) {
  const orderOffset = Number.isFinite(options.orderOffset) ? options.orderOffset : 0;
  const blockOffset = Number.isFinite(options.blockOffset) ? options.blockOffset : 0;
  const tokens = lex(body);
  tokens.forEach((token, i) => {
    token.order = orderOffset + i;
  });

  const expanded = [];
  const state = { lastName: null };
  let nextBlock = blockOffset;

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) break;

    if (token.text !== "[") {
      parseSimpleRange(tokens, i, i + 1, state, null, expanded);
      i += 1;
      continue;
    }

    let close = -1;
    for (let j = i + 1; j < tokens.length; j += 1) {
      if (tokens[j].text === "]") {
        close = j;
        break;
      }
    }

    if (close < 0) {
      token.kind = "unknown";
      i += 1;
      continue;
    }

    const repeatToken = tokens[close + 1];
    const repeatCount = repeatToken ? parseRepeat(repeatToken.text) : null;
    const blockMeta = {
      id: `block-${nextBlock}`,
      live: !repeatCount,
      startOrder: token.order,
      endOrder: tokens[close].order,
    };
    nextBlock += 1;

    const innerExpanded = [];
    parseSimpleRange(tokens, i, close + 1, state, blockMeta, innerExpanded);

    if (!innerExpanded.length) {
      i = close + (repeatCount ? 2 : 1);
      if (repeatToken && repeatCount) {
        repeatToken.kind = "repeat";
      }
      continue;
    }

    if (repeatToken && repeatCount) {
      repeatToken.kind = "repeat";
      for (let n = 0; n < repeatCount; n += 1) {
        innerExpanded.forEach((item) => {
          expanded.push({
            ...item,
            displayOrder: n === 0 ? item.displayOrder : repeatToken.order,
            blockLive: false,
          });
        });
      }
      i = close + 2;
      continue;
    }

    expanded.push(...innerExpanded);
    i = close + 1;
  }

  return {
    tokens,
    expanded,
    nextOrder: orderOffset + tokens.length,
    nextBlock,
  };
}

export function buildArrangementMain(body) {
  const parsed = parseArrangementBody(body);
  if (parsed.tokens.some((token) => token.kind === "unknown")) return null;
  if (!parsed.expanded.length) return null;
  return parsed.expanded.map((item) => ({ type: "value", value: item.name }));
}
