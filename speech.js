// Thin wrapper over speechSynthesis. Must be called from touch handlers (iOS rule).
const norm = (lang) => String(lang || '').toLowerCase().replace('_', '-');

export function pickRussianVoice(voices) {
  const list = voices || [];
  return list.find((v) => norm(v.lang) === 'ru-ru') || list.find((v) => norm(v.lang).startsWith('ru')) || null;
}

export function createSpeech(synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  return {
    speak(text) {
      if (!synth || !Utterance) return;
      try {
        synth.cancel();
        const u = new Utterance(text);
        u.lang = 'ru-RU';
        u.rate = 0.8;
        const voice = pickRussianVoice(synth.getVoices());
        if (voice) u.voice = voice;
        synth.speak(u);
      } catch { /* no sound is better than an error in front of a child */ }
    },
    hasRussianVoice() {
      if (!synth) return false;
      try { return pickRussianVoice(synth.getVoices()) !== null; } catch { return false; }
    },
  };
}
