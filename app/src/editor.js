// Vice Panel Studio editor wiring: photo loading from disk, panel selection and dragging, the control
// bindings, and PNG export. Photos are read with FileReader/object URLs on this machine and never uploaded.
import { PANEL_LAYOUTS, POSTER_SIZES, syncPanelsToLayout } from './state.js';
import { panelRectsInPixels, renderPoster } from './render.js';

const MAX_PHOTOS = 4;

/** Loads an image element from a URL (an object URL for a local file, or a samples/ path). */
export function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = url;
  });
}

/** Adds one photo to the state (capped at four) and returns a status line for the user. */
async function addPhoto(state, name, url) {
  if (state.photos.length >= MAX_PHOTOS) return `Four photos is the limit — remove one to add ${name}.`;
  const image = await loadImageElement(url);
  state.photos.push({ name, image });
  return `Added ${name} (${state.photos.length} of ${MAX_PHOTOS}).`;
}

/** Rebuilds the photo list and the per-panel photo select to match the state. */
function refreshPhotoControls(state, els, onChange) {
  els.photoList.textContent = '';
  state.photos.forEach((photo, index) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${index + 1}. ${photo.name}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.photos.splice(index, 1);
      onChange(`Removed ${photo.name}.`);
    });
    li.append(label, remove);
    els.photoList.append(li);
  });
  els.panelPhoto.textContent = '';
  state.photos.forEach((photo, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${photo.name}`;
    els.panelPhoto.append(option);
  });
  const crop = state.panels[state.selectedPanel];
  if (crop && state.photos.length > 0) {
    els.panelPhoto.value = String(((crop.photoIndex % state.photos.length) + state.photos.length) % state.photos.length);
  }
}

/** Marks the active button in a choice row (layout and grade pickers). */
function markActiveChoice(row, attribute, value) {
  row.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset[attribute] === value);
  });
}

/** Converts a pointer event on the preview canvas into poster pixel coordinates. */
function pointerInPoster(canvas, event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  };
}

/** Finds which panel a poster-space point falls in, or -1. */
function panelAtPoint(state, point) {
  const rects = panelRectsInPixels(state);
  return rects.findIndex(
    (r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h,
  );
}

/** Wires every control in index.html to the state and keeps the preview canvas painted. */
export function wireEditor(state) {
  const els = {
    canvas: document.getElementById('cover-canvas'),
    photoFiles: document.getElementById('photo-files'),
    photoList: document.getElementById('photo-list'),
    layoutChoices: document.getElementById('layout-choices'),
    sizeSelect: document.getElementById('size-select'),
    panelPhoto: document.getElementById('panel-photo'),
    panelZoom: document.getElementById('panel-zoom'),
    zoomValue: document.getElementById('zoom-value'),
    panelReset: document.getElementById('panel-reset'),
    gradeChoices: document.getElementById('grade-choices'),
    gradeStrength: document.getElementById('grade-strength'),
    gradeValue: document.getElementById('grade-value'),
    title: document.getElementById('caption-title'),
    subtitle: document.getElementById('caption-subtitle'),
    captionSize: document.getElementById('caption-size'),
    captionSizeValue: document.getElementById('caption-size-value'),
    captionPosition: document.getElementById('caption-position'),
    exportButton: document.getElementById('export-png'),
    status: document.getElementById('status'),
  };

  const say = (message) => { els.status.textContent = message; };
  const redraw = () => renderPoster(els.canvas, state);
  const refreshPanelControls = () => {
    const crop = state.panels[state.selectedPanel];
    els.panelZoom.value = String(crop.zoom);
    els.zoomValue.textContent = `${crop.zoom.toFixed(2)}×`;
    refreshPhotoControls(state, els, (message) => { say(message); redraw(); });
  };
  const changed = (message) => { if (message) say(message); refreshPanelControls(); redraw(); };

  els.photoFiles.addEventListener('change', async (event) => {
    for (const file of event.target.files) {
      try {
        say(await addPhoto(state, file.name, URL.createObjectURL(file)));
      } catch (error) {
        say(error.message);
      }
    }
    event.target.value = '';
    changed();
  });

  document.getElementById('sample-pier').addEventListener('click', async () => {
    say(await addPhoto(state, 'Pier (sample)', 'samples/pier.jpg'));
    changed();
  });
  document.getElementById('sample-boulevard').addEventListener('click', async () => {
    say(await addPhoto(state, 'Boulevard (sample)', 'samples/boulevard.jpg'));
    changed();
  });

  els.layoutChoices.addEventListener('click', (event) => {
    const key = event.target.dataset.layout;
    if (!key || !PANEL_LAYOUTS[key]) return;
    state.layoutKey = key;
    syncPanelsToLayout(state);
    markActiveChoice(els.layoutChoices, 'layout', key);
    changed(`Layout: ${PANEL_LAYOUTS[key].length} panel${PANEL_LAYOUTS[key].length > 1 ? 's' : ''}.`);
  });

  els.sizeSelect.addEventListener('change', () => {
    state.sizeKey = els.sizeSelect.value;
    changed(`Poster size: ${POSTER_SIZES[state.sizeKey].label}.`);
  });

  els.panelPhoto.addEventListener('change', () => {
    state.panels[state.selectedPanel].photoIndex = Number(els.panelPhoto.value);
    redraw();
  });

  els.panelZoom.addEventListener('input', () => {
    const crop = state.panels[state.selectedPanel];
    crop.zoom = Number(els.panelZoom.value);
    els.zoomValue.textContent = `${crop.zoom.toFixed(2)}×`;
    redraw();
  });

  els.panelReset.addEventListener('click', () => {
    const crop = state.panels[state.selectedPanel];
    crop.zoom = 1;
    crop.offsetX = 0;
    crop.offsetY = 0;
    changed(`Panel ${state.selectedPanel + 1} crop reset.`);
  });

  els.gradeChoices.addEventListener('click', (event) => {
    const key = event.target.dataset.grade;
    if (!key) return;
    state.gradeKey = key;
    markActiveChoice(els.gradeChoices, 'grade', key);
    changed();
  });

  els.gradeStrength.addEventListener('input', () => {
    state.gradeStrength = Number(els.gradeStrength.value);
    els.gradeValue.textContent = `${Math.round(state.gradeStrength * 100)}%`;
    redraw();
  });

  els.title.addEventListener('input', () => { state.title = els.title.value; redraw(); });
  els.subtitle.addEventListener('input', () => { state.subtitle = els.subtitle.value; redraw(); });
  els.captionSize.addEventListener('input', () => {
    state.captionScale = Number(els.captionSize.value);
    els.captionSizeValue.textContent = `${Math.round(state.captionScale * 100)}%`;
    redraw();
  });
  els.captionPosition.addEventListener('change', () => {
    state.captionPosition = els.captionPosition.value;
    redraw();
  });

  let drag = null;
  els.canvas.addEventListener('pointerdown', (event) => {
    const point = pointerInPoster(els.canvas, event);
    const index = panelAtPoint(state, point);
    if (index < 0) return;
    state.selectedPanel = index;
    const crop = state.panels[index];
    drag = { startX: point.x, startY: point.y, offsetX: crop.offsetX, offsetY: crop.offsetY };
    els.canvas.setPointerCapture(event.pointerId);
    els.canvas.classList.add('dragging');
    changed(`Panel ${index + 1} selected — drag to reposition.`);
  });
  els.canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = pointerInPoster(els.canvas, event);
    const rect = panelRectsInPixels(state)[state.selectedPanel];
    const crop = state.panels[state.selectedPanel];
    crop.offsetX = Math.min(0.5, Math.max(-0.5, drag.offsetX + (point.x - drag.startX) / rect.w));
    crop.offsetY = Math.min(0.5, Math.max(-0.5, drag.offsetY + (point.y - drag.startY) / rect.h));
    redraw();
  });
  const endDrag = () => { drag = null; els.canvas.classList.remove('dragging'); };
  els.canvas.addEventListener('pointerup', endDrag);
  els.canvas.addEventListener('pointercancel', endDrag);

  els.exportButton.addEventListener('click', () => {
    const offscreen = document.createElement('canvas');
    renderPoster(offscreen, state, { forExport: true });
    offscreen.toBlob((blob) => {
      if (!blob) { say('Export failed — the browser could not encode the PNG.'); return; }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `vice-panel-cover-${state.sizeKey}.png`;
      link.click();
      say(`Saved vice-panel-cover-${state.sizeKey}.png (${POSTER_SIZES[state.sizeKey].label}).`);
    }, 'image/png');
  });

  refreshPanelControls();
  redraw();
  return { redraw, say };
}

/** Loads the two bundled sample photos so the studio opens with a finished-looking poster. */
export async function loadSamplePhotos(state) {
  for (const [name, path] of [['Pier (sample)', 'samples/pier.jpg'], ['Boulevard (sample)', 'samples/boulevard.jpg']]) {
    try {
      await addPhoto(state, name, path);
    } catch {
      // A missing sample just leaves the panel on its placeholder; the user can add their own photos.
    }
  }
}
