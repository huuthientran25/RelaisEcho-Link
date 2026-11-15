// Unit tests (Node's built in runner): npm test
// Each block below keeps its own imports and helpers, so names cannot collide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ---------- Automatic dental comparison ----------
{
  const { rgbToLab, classify, mouthMask, analyzeMouth, compareMouth, changeMap } = await import('../js/dentalcmp.js');

  test('CIELAB conversion matches known values', () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    assert.ok(Math.abs(L - 100) < 0.1 && Math.abs(a) < 0.5 && Math.abs(b) < 0.5);
    const red = rgbToLab(255, 0, 0);
    assert.ok(Math.abs(red[0] - 53.2) < 0.5 && Math.abs(red[1] - 80.1) < 0.6 && Math.abs(red[2] - 67.2) < 0.6);
    assert.equal(classify(rgbToLab(235, 228, 210)), 'tooth');
    assert.equal(classify(rgbToLab(200, 90, 100)), 'gum');
  });

  // Synthetic mouth: upper half gum colour, lower half tooth colour.
  function mouth(w, h, tooth, gum, light = 1) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = y < h * 0.45 ? gum : tooth;
      const i = (y * w + x) * 4;
      d[i] = c[0] * light; d[i + 1] = c[1] * light; d[i + 2] = c[2] * light; d[i + 3] = 255;
    }
    return d;
  }

  test('same mouth: comparable, no flags, no change', () => {
    const w = 60, h = 34, m = mouthMask(w, h, null);
    const A = analyzeMouth(mouth(w, h, [235, 228, 210], [200, 90, 100]), w, h, m);
    const B = analyzeMouth(mouth(w, h, [235, 228, 210], [200, 90, 100]), w, h, m);
    const r = compareMouth(A, B);
    assert.equal(r.comparable, true);
    assert.equal(r.flags.length, 0);
    assert.equal(changeMap(A.lab, B.lab, m).changedPct, 0);
  });

  test('yellower teeth and redder gums are flagged', () => {
    const w = 60, h = 34, m = mouthMask(w, h, null);
    const base = analyzeMouth(mouth(w, h, [235, 228, 210], [190, 110, 115]), w, h, m);
    const today = analyzeMouth(mouth(w, h, [238, 226, 180], [205, 80, 95]), w, h, m);
    const r = compareMouth(today, base);
    assert.equal(r.comparable, true);
    assert.ok(r.toothYellowDelta > 4, `b* ${r.toothYellowDelta}`);
    assert.ok(r.gumRedDelta > 5, `a* ${r.gumRedDelta}`);
    assert.equal(r.flags.length, 2);
  });

  test('different lighting withholds the colour comparison', () => {
    const w = 60, h = 34, m = mouthMask(w, h, null);
    const base = analyzeMouth(mouth(w, h, [235, 228, 210], [200, 90, 100]), w, h, m);
    const dim = analyzeMouth(mouth(w, h, [235, 228, 210], [200, 90, 100], 0.7), w, h, m);
    const r = compareMouth(dim, base);
    assert.equal(r.comparable, false);
    assert.match(r.notes[0], /Lighting differs/);
    assert.equal(r.flags.length, 0);
  });
}

// ---------- French coaching phrases ----------
{
  const { phrase, PHRASES_FR } = await import('../js/i18n.js');

  test('every live coaching phrase in the code has a French version', () => {
    const src = ['../js/main.js', '../js/align.js', '../js/dental.js'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    // Coach messages returned as plain string literals.
    const found = new Set();
    for (const m of src.matchAll(/return '([A-Z][^']{3,})'/g)) found.add(m[1]);
    for (const m of src.matchAll(/msg: '([^']+)'/g)) found.add(m[1]);
    for (const m of src.matchAll(/\? '([A-Z][^']+)' : '([A-Z][^']+)'/g)) { found.add(m[1]); found.add(m[2]); }
    const coachish = [...found].filter((t) => /^(Hold|Bring|Come|Move|Too|Camera is|Level|Turn|Raise|Lower|Adjust|Face not|Smile|Glare)/.test(t));
    assert.ok(coachish.length >= 20, `found ${coachish.length}`);
    for (const t of coachish) assert.ok(PHRASES_FR[t], `missing French: ${t}`);
  });

  test('dynamic phrases translate, English passes through', () => {
    assert.equal(phrase('en', 'Hold still'), 'Hold still');
    assert.equal(phrase('fr', 'Low frame rate (10 fps), results less certain'), 'Fréquence d’images basse (10 i/s), résultats moins sûrs');
    assert.equal(phrase('fr', 'Front: Hold still'), 'Face : Restez immobile');
    assert.equal(phrase('fr', 'Your left side captured'), 'Votre côté gauche : photo prise');
    assert.equal(phrase('fr', 'Unknown text'), 'Unknown text');
  });
}
