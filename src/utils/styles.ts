export const loaderStyles = `
  background-color: #ffffff30;
  border: 1px solid #ffffff80;
  border-radius: 6px;
  color: #fff;
  padding: 20px;
  position: absolute;
  transform: translate(-50%, -50%);
  visibility: hidden;
  zIndex: 999;
`;

export const tooltipsStyles = `
  height: 100%;
  left: 0;
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 100%;
`;

export const tooltipElementStyles = `
.glob3d-tooltip {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  color: #000;
  column-gap: 15px;
  display: grid;
  font-size: 0.8rem;
  grid-template-columns: repeat(3, auto);
  left: 10px;
  opacity: 0;
  padding: 10px;
  pointer-events: none;
  position: absolute;
  row-gap: 5px;
  top: 10px;
  transform-origin: top left;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s;
  user-select: none;
}
.glob3d-tooltip-visible {
  opacity: 1;
}
.glob3d-tooltip-active {
  background-color: var(--tooltip-active-bg);
  color: var(--tooltip-active-fg);
}
.glob3d-tooltip-rank {
  align-items: center;
  background-color: #fff;
  border: 2px solid var(--tooltip-accent);
  border-radius: 50%;
  color: var(--tooltip-accent);
  display: flex;
  font-weight: bold;
  grid-row: 1 / 3;
  height: 30px;
  justify-content: center;
  margin: 0;
  width: 30px;
}
.glob3d-tooltip-country {
  grid-column: 2 / 3;
  margin: 0;
}
.glob3d-tooltip-city {
  grid-column: 3 / 4;
  margin: 0;
}
.glob3d-tooltip-value {
  grid-column: 2 / 4;
  margin: 0;
}
`;

const TOOLTIP_STYLE_ID = 'glob3d-tooltip-styles';

export function ensureTooltipStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(TOOLTIP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOOLTIP_STYLE_ID;
  style.textContent = tooltipElementStyles;
  document.head.appendChild(style);
}
