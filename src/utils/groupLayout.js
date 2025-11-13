const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 160;
const GROUP_PADDING = 96;
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 260;
const SINGLE_NODE_PADDING = 260;
const SINGLE_NODE_MIN_WIDTH = 720;
const SINGLE_NODE_MIN_HEIGHT = 760;

export function computeGroupLayout(nodes = [], targetIds = []) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return null;
  }
  const targetSet = new Set(targetIds);
  const candidateNodes = nodes.filter((node) => targetSet.has(node.id));
  if (candidateNodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  candidateNodes.forEach((node) => {
    const position = node.position || { x: 0, y: 0 };
    const width = Number.isFinite(node.width) && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
    const height = Number.isFinite(node.height) && node.height > 0 ? node.height : DEFAULT_NODE_HEIGHT;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  const isSingle = candidateNodes.length === 1;
  const padding = isSingle ? SINGLE_NODE_PADDING : GROUP_PADDING;
  const rawWidth = Math.max(0, maxX - minX);
  const rawHeight = Math.max(0, maxY - minY);
  const width = isSingle
    ? Math.max(rawWidth + padding * 2, SINGLE_NODE_MIN_WIDTH)
    : Math.max(rawWidth + padding * 2, GROUP_MIN_WIDTH);
  const height = isSingle
    ? Math.max(rawHeight + padding * 2, SINGLE_NODE_MIN_HEIGHT)
    : Math.max(rawHeight + padding * 2, GROUP_MIN_HEIGHT);

  const position = {
    x: minX + (rawWidth) / 2 - width / 2,
    y: minY + (rawHeight) / 2 - height / 2,
  };

  return {
    position,
    width,
    height,
    minWidth: isSingle ? SINGLE_NODE_MIN_WIDTH : GROUP_MIN_WIDTH,
    minHeight: isSingle ? SINGLE_NODE_MIN_HEIGHT : GROUP_MIN_HEIGHT,
  };
}





