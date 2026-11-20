// Vice Panel Studio entry point: builds the state, loads the sample photos, wires the editor, and — when the
// page is opened with a ?shot= query — sets up a fixed scene for screenshots instead of the live editor.
import { createStudioState, syncPanelsToLayout } from './state.js';
import { loadImageElement, loadSamplePhotos, wireEditor } from './editor.js';
import { renderPoster } from './render.js';

/** Applies a ?shot= scene: fixed size/layout/grade/caption over the sample photos, then flags readiness. */
async function runShotScene(state, query) {
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const size = query.get('size');
  if (size) state.sizeKey = size;
  const layout = query.get('layout');
  if (layout) state.layoutKey = layout;
  const grade = query.get('grade');
  if (grade) state.gradeKey = grade;
  const title = query.get('title');
  if (title !== null) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  syncPanelsToLayout(state);
  const sample = query.get('photo') ?? 'pier';
  const other = sample === 'pier' ? 'boulevard' : 'pier';
  for (const name of [sample, other]) {
    try {
      const image = await loadImageElement(`samples/${name}.jpg`);
      state.photos.push({ name: `${name} (sample)`, image });
    } catch {
      // Leave the panel on its placeholder if a sample is missing.
    }
  }
  const canvas = document.getElementById('cover-canvas');
  renderPoster(canvas, state, { forExport: shot === 'cover' });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** Boots the studio: live editor by default, fixed screenshot scene when ?shot= is present. */
async function bootStudio() {
  const state = createStudioState();
  const query = new URLSearchParams(location.search);
  if (query.get('shot')) {
    await runShotScene(state, query);
    return;
  }
  await loadSamplePhotos(state);
  wireEditor(state);
}

bootStudio();
