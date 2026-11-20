// Vice Panel Studio renderer: draws the whole poster — panel photos with their crops, black poster borders,
// the colour grade, a vignette and the bold outlined caption — onto any canvas at the poster's own size.
import { COLOUR_GRADES, PANEL_LAYOUTS, POSTER_SIZES, photoForPanel } from './state.js';

const BORDER_FRACTION = 0.006; // black border between panels, as a fraction of poster width
const CAPTION_FONT_STACK = '"Arial Black", "Archivo Black", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Panel rectangles in pixels for the state's layout and poster size, borders already carved out. */
export function panelRectsInPixels(state) {
  const { width, height } = POSTER_SIZES[state.sizeKey];
  const border = Math.max(2, Math.round(width * BORDER_FRACTION));
  return PANEL_LAYOUTS[state.layoutKey].map((p) => {
    const x = Math.round(p.x * width);
    const y = Math.round(p.y * height);
    const w = Math.round(p.w * width);
    const h = Math.round(p.h * height);
    const left = x === 0 ? 0 : border;
    const top = y === 0 ? 0 : border;
    const right = x + w >= width ? 0 : border;
    const bottom = y + h >= height ? 0 : border;
    return { x: x + left, y: y + top, w: w - left - right, h: h - top - bottom };
  });
}

/** Draws one photo cover-fit into a panel rect, honouring the panel's zoom and drag offsets. */
function drawPanelPhoto(ctx, photo, rect, crop, filter) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!photo) {
    ctx.fillStyle = '#241a38';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(246, 241, 234, 0.55)';
    ctx.font = `600 ${Math.round(rect.h * 0.06)}px ${CAPTION_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const img = photo.image;
  const baseScale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = baseScale * crop.zoom;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const slackX = Math.max(0, drawW - rect.w);
  const slackY = Math.max(0, drawH - rect.h);
  const dx = rect.x - slackX / 2 + crop.offsetX * slackX;
  const dy = rect.y - slackY / 2 + crop.offsetY * slackY;
  ctx.filter = filter;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.filter = 'none';
  ctx.restore();
}

/** Paints the grade's two-stop gradient over the poster at the chosen strength. */
function paintGradeOverlay(ctx, width, height, grade, strength) {
  if (strength <= 0) return;
  const gradient = ctx.createLinearGradient(0, 0, width * 0.35, height);
  gradient.addColorStop(0, grade.overlay.from);
  gradient.addColorStop(1, grade.overlay.to);
  ctx.save();
  ctx.globalCompositeOperation = grade.overlay.mode;
  ctx.globalAlpha = strength;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Darkens the poster's edges with a radial vignette. */
function paintVignette(ctx, width, height, strength) {
  if (strength <= 0) return;
  const radius = Math.hypot(width, height) / 2;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, radius * 0.45, width / 2, height / 2, radius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Shrinks a font size until the text fits the given width, returning the size used. */
function fitFontSize(ctx, text, startSize, maxWidth, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${CAPTION_FONT_STACK}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${CAPTION_FONT_STACK}`;
  }
  return size;
}

/** Draws the title and subtitle: heavy white lettering with a black outline and a soft drop shadow. */
function drawCaption(ctx, width, height, state) {
  const title = state.title.trim().toUpperCase();
  const subtitle = state.subtitle.trim().toUpperCase();
  if (!title && !subtitle) return;
  const unit = Math.min(width, height);
  const titleSize = fitFontSize(ctx, title || subtitle, unit * 0.13 * state.captionScale, width * 0.92, 900);
  const subSize = subtitle ? fitFontSize(ctx, subtitle, titleSize * 0.34, width * 0.9, 700) : 0;
  const blockHeight = titleSize + (subtitle ? subSize * 1.5 : 0);
  let baseline;
  if (state.captionPosition === 'top') baseline = height * 0.05 + titleSize;
  else if (state.captionPosition === 'center') baseline = height / 2 - blockHeight / 2 + titleSize;
  else baseline = height - height * 0.055 - (subtitle ? subSize * 1.5 : 0);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = titleSize * 0.18;
  ctx.shadowOffsetY = titleSize * 0.06;
  if (title) {
    ctx.font = `900 ${titleSize}px ${CAPTION_FONT_STACK}`;
    ctx.strokeStyle = '#0d0a14';
    ctx.lineWidth = Math.max(2, titleSize * 0.16);
    ctx.strokeText(title, width / 2, baseline);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, width / 2, baseline);
  }
  if (subtitle) {
    const subY = baseline + subSize * 1.45;
    ctx.font = `700 ${subSize}px ${CAPTION_FONT_STACK}`;
    ctx.strokeStyle = '#0d0a14';
    ctx.lineWidth = Math.max(2, subSize * 0.22);
    ctx.strokeText(subtitle, width / 2, subY);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subtitle, width / 2, subY);
  }
  ctx.restore();
}

/** Outlines the selected panel so the user can see which crop the controls are editing (preview only). */
function outlineSelectedPanel(ctx, rect) {
  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = Math.max(3, rect.w * 0.006);
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
  ctx.restore();
}

/**
 * Draws the complete poster for `state` onto `canvas`. The canvas is resized to the poster size first.
 * Pass `{ forExport: true }` to skip the selection outline.
 */
export function renderPoster(canvas, state, options = {}) {
  const { width, height } = POSTER_SIZES[state.sizeKey];
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  const grade = COLOUR_GRADES[state.gradeKey];
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  const rects = panelRectsInPixels(state);
  rects.forEach((rect, index) => {
    drawPanelPhoto(ctx, photoForPanel(state, index), rect, state.panels[index], grade.filter);
  });
  paintGradeOverlay(ctx, width, height, grade, state.gradeStrength);
  paintVignette(ctx, width, height, grade.vignette * state.gradeStrength);
  drawCaption(ctx, width, height, state);
  if (!options.forExport && rects[state.selectedPanel]) {
    outlineSelectedPanel(ctx, rects[state.selectedPanel]);
  }
}
