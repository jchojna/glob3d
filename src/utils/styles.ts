import defaultOpts from './defaultOpts';

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
  background: rgb(
    from var(--tooltip-globe, ${defaultOpts.globeColor}) r g b / 0.3
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.9);
  column-gap: 15px;
  display: grid;
  font-size: 0.8rem;
  grid-template-columns: repeat(3, auto);
  left: 5px;
  opacity: 0;
  padding: 10px;
  pointer-events: none;
  position: absolute;
  row-gap: 5px;
  top: 5px;
  transform-origin: top left;
  transition: opacity 0.2s;
  user-select: none;
}

.glob3d-tooltip-visible {
  opacity: 1;
}

.glob3d-tooltip-active {
  background: rgb(
    from var(--tooltip-accent, ${defaultOpts.barActiveColor}) r g b / 0.5
  );
}

.glob3d-tooltip-rank {
  align-items: center;
  background: var(--tooltip-globe);
  border: 1px solid var(--tooltip-accent);
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
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  grid-column: 2 / 3;
  margin: 0;
}

.glob3d-tooltip-city {
  color: rgba(255, 255, 255, 0.6);
  grid-column: 3 / 4;
  margin: 0;
}

.glob3d-tooltip-value {
  color: rgba(255, 255, 255);
  font-weight: 600;
  font-size: 0.85rem;
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
