export const SOURCE_PALETTE = [
  "#5e6bff", "#00c4ff", "#7fe0a7", "#ffca6e", "#ff8b8b",
  "#9b8cff", "#ff6eb4", "#4ecdc4", "#f7dc6f", "#a29bfe",
  "#fd79a8", "#00b894", "#e17055", "#74b9ff", "#dfe6e9",
  "#b8e994", "#f8c291", "#6c5ce7", "#81ecec", "#fab1a0",
  "#55efc4", "#636e72",
];

export function getSourceColor(index: number) {
  return SOURCE_PALETTE[index % SOURCE_PALETTE.length];
}

export function buildConicGradient(dataset: { value: number }[]) {
  const total = dataset.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "conic-gradient(#182947 0deg 360deg)";
  }

  let currentAngle = 0;
  const segments = dataset.map((item, index) => {
    const segmentAngle = (item.value / total) * 360;
    const color = getSourceColor(index);
    const segment = `${color} ${currentAngle}deg ${currentAngle + segmentAngle}deg`;
    currentAngle += segmentAngle;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}
