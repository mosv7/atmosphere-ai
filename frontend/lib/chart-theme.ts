const darkPalette = ["#52e0ac", "#7ccee8", "#f1bf72", "#c6b3e8", "#e88b91"];
const lightPalette = ["#087b59", "#08779a", "#946112", "#7651a4", "#b64250"];
export function chartPalette(theme: "dark" | "light") {
  return theme === "dark" ? darkPalette : lightPalette;
}
export function chartColor(color: string | undefined, theme: "dark" | "light") {
  if (!color || theme === "dark") return color;
  const index = darkPalette.indexOf(color.toLowerCase());
  return index >= 0
    ? lightPalette[index]
    : color === "#9dadbf"
      ? "#526676"
      : color;
}
