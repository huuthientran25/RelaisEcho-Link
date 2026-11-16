// AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
// Spoken coaching: reads coach messages aloud with the device's own speech engine (works offline on most phones).
// Speaks only when the message changes, at most once every 2 s, always the latest message.
export function makeSpeaker({ synth, Utterance, minGapMs = 2000, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let enabled = false, last = '', lastT = -Infinity, pending = null, timer = null, lang = 'en-CA';
  const speakNow = (text) => {
    if (!synth || !Utterance) return;
    synth.cancel();
    const u = new Utterance(text);
    u.lang = lang;
    u.rate = 0.95;
    synth.speak(u);
    last = text; lastT = now(); pending = null;
  };
  return {
    setEnabled(v) { enabled = !!v; if (!enabled && synth) { synth.cancel(); pending = null; if (timer) clearTimer(timer); } },
    setLang(l) { lang = l; },
    get enabled() { return enabled; },
    say(text) {
      const t = String(text || '').trim();
      if (!enabled || !t || t === last || t.endsWith('…')) return false;
      const wait = minGapMs - (now() - lastT);
      if (wait <= 0) { speakNow(t); return true; }
      pending = t;
      if (!timer) timer = setTimer(() => { timer = null; if (pending && enabled) speakNow(pending); }, wait);
      return false;
    },
  };
}
