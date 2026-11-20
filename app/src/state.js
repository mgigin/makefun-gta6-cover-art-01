// Vice Panel Studio state: the cover being edited, the poster sizes, the panel layouts and the colour grades.
// Everything here is plain data plus small helpers; drawing lives in render.js and DOM wiring in editor.js.

/** The three common post sizes the studio exports, keyed by the select value in index.html. */
export const POSTER_SIZES = {
  '1080x1080': { width: 1080, height: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { width: 1080, height: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { width: 1920, height: 1080, label: 'Landscape 1920 × 1080' },
};

/** Panel rectangles for each layout, as fractions of the poster (x, y, w, h). Gaps are carved out at draw time. */
export const PANEL_LAYOUTS = {
  single: [{ x: 0, y: 0, w: 1, h: 1 }],
  split2: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  trio: [
    { x: 0, y: 0, w: 0.58, h: 1 },
    { x: 0.58, y: 0, w: 0.42, h: 0.5 },
    { x: 0.58, y: 0.5, w: 0.42, h: 0.5 },
  ],
  grid4: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
};

/**
 * Colour grades. `filter` is the canvas filter applied while a photo is drawn; `overlay` is a two-stop
 * gradient painted over the whole poster with the given composite mode and alpha; `vignette` darkens edges.
 */
export const COLOUR_GRADES = {
  vice: {
    label: 'Vice sunset',
    filter: 'saturate(1.35) contrast(1.1) brightness(1.05)',
    overlay: { from: 'rgba(255, 94, 138, 0.55)', to: 'rgba(255, 140, 66, 0.65)', mode: 'soft-light' },
    vignette: 0.25,
  },
  neon: {
    label: 'Neon night',
    filter: 'saturate(1.6) contrast(1.15) hue-rotate(-12deg) brightness(1.02)',
    overlay: { from: 'rgba(38, 198, 255, 0.5)', to: 'rgba(255, 45, 180, 0.55)', mode: 'soft-light' },
    vignette: 0.35,
  },
  golden: {
    label: 'Golden hour',
    filter: 'sepia(0.35) saturate(1.25) contrast(1.05) brightness(1.08)',
    overlay: { from: 'rgba(255, 196, 110, 0.45)', to: 'rgba(255, 120, 60, 0.5)', mode: 'soft-light' },
    vignette: 0.2,
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.3) brightness(1.02)',
    overlay: { from: 'rgba(20, 20, 30, 0.35)', to: 'rgba(0, 0, 0, 0.55)', mode: 'multiply' },
    vignette: 0.55,
  },
};

/** The default crop for one panel: photo index, zoom (1 = cover-fit) and centre offsets as fractions. */
export function defaultPanelCrop(photoIndex) {
  return { photoIndex, zoom: 1, offsetX: 0, offsetY: 0 };
}

/** A fresh studio state with the sample-friendly defaults the page opens with. */
export function createStudioState() {
  return {
    sizeKey: '1920x1080',
    layoutKey: 'grid4',
    gradeKey: 'vice',
    gradeStrength: 1,
    photos: [], // [{ name, image }] — images are HTMLImageElement, read locally, never uploaded
    panels: [0, 1, 2, 3].map((i) => defaultPanelCrop(i)),
    selectedPanel: 0,
    title: 'SUNSET CITY',
    subtitle: 'MADE WITH VICE PANEL STUDIO',
    captionScale: 1,
    captionPosition: 'bottom',
  };
}

/** Keeps the panels array the same length as the current layout, preserving crops that still exist. */
export function syncPanelsToLayout(state) {
  const wanted = PANEL_LAYOUTS[state.layoutKey].length;
  while (state.panels.length < wanted) state.panels.push(defaultPanelCrop(state.panels.length));
  state.panels.length = wanted;
  if (state.selectedPanel >= wanted) state.selectedPanel = 0;
}

/** The photo a panel shows: its assigned photo, cycling through the loaded photos when unassigned. */
export function photoForPanel(state, panelIndex) {
  if (state.photos.length === 0) return null;
  const wanted = state.panels[panelIndex].photoIndex;
  const index = ((wanted % state.photos.length) + state.photos.length) % state.photos.length;
  return state.photos[index];
}
