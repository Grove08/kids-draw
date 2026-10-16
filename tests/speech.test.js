import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRussianVoice, createSpeech } from '../speech.js';

class FakeUtterance { constructor(text) { this.text = text; } }
const fakeSynth = (voices = []) => {
  const calls = [];
  return { calls, getVoices: () => voices, cancel: () => calls.push('cancel'), speak: (u) => calls.push(u), voices };
};

test('prefers ru-RU over other ru voices', () => {
  const v = [{ lang: 'ru-BY', name: 'b' }, { lang: 'en-US', name: 'e' }, { lang: 'ru-RU', name: 'r' }];
  assert.equal(pickRussianVoice(v).name, 'r');
});
test('accepts ru_RU style codes', () => {
  assert.equal(pickRussianVoice([{ lang: 'ru_RU', name: 'x' }]).name, 'x');
});
test('returns null when no Russian voice', () => {
  assert.equal(pickRussianVoice([{ lang: 'en-US', name: 'e' }]), null);
  assert.equal(pickRussianVoice([]), null);
});
test('speak cancels previous speech before speaking', () => {
  const s = fakeSynth();
  createSpeech(s, FakeUtterance).speak('А');
  assert.equal(s.calls[0], 'cancel');
  assert.equal(s.calls[1].text, 'А');
});
test('speak sets lang ru-RU, rate 0.8 and the chosen voice', () => {
  const voice = { lang: 'ru-RU', name: 'Milena' };
  const s = fakeSynth([voice]);
  createSpeech(s, FakeUtterance).speak('Б');
  const u = s.calls[1];
  assert.equal(u.lang, 'ru-RU');
  assert.equal(u.rate, 0.8);
  assert.equal(u.voice, voice);
});
test('speak does nothing and does not throw without synth', () => {
  createSpeech(undefined, FakeUtterance).speak('В');
  createSpeech(fakeSynth(), undefined).speak('В');
});
test('speak swallows exceptions from synth.speak', () => {
  const s = fakeSynth();
  s.speak = () => { throw new Error('not allowed'); };
  createSpeech(s, FakeUtterance).speak('Г');
});
test('hasRussianVoice reflects the voices available at call time', () => {
  const s = fakeSynth([]);
  const sp = createSpeech(s, FakeUtterance);
  assert.equal(sp.hasRussianVoice(), false);
  s.getVoices = () => [{ lang: 'ru-RU', name: 'r' }];
  assert.equal(sp.hasRussianVoice(), true);
  assert.equal(createSpeech(undefined, FakeUtterance).hasRussianVoice(), false);
});
