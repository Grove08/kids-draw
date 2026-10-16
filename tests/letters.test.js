import test from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS } from '../letters.js';

const ORDER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

test('has 33 letters', () => assert.equal(LETTERS.length, 33));
test('letters are unique and in alphabetical order with Ё after Е', () => {
  assert.equal(LETTERS.map((l) => l.ch).join(''), ORDER);
});
test('every say is a non-empty string', () => {
  for (const l of LETTERS) assert.ok(typeof l.say === 'string' && l.say.length > 0, l.ch);
});
test('А says "А. Арбуз." and has emoji 🍉', () => {
  assert.equal(LETTERS[0].say, 'А. Арбуз.');
  assert.equal(LETTERS[0].emoji, '🍉');
});
test('Ъ Ь Ы have null word and emoji and their special say', () => {
  const by = Object.fromEntries(LETTERS.map((l) => [l.ch, l]));
  assert.deepEqual([by['Ъ'].word, by['Ъ'].emoji, by['Ъ'].say], [null, null, 'Твёрдый знак.']);
  assert.deepEqual([by['Ь'].word, by['Ь'].emoji, by['Ь'].say], [null, null, 'Мягкий знак.']);
  assert.deepEqual([by['Ы'].word, by['Ы'].emoji, by['Ы'].say], [null, null, 'Ы.']);
});
test('every other letter has a word and an emoji', () => {
  for (const l of LETTERS.filter((x) => !'ЪЫЬ'.includes(x.ch))) {
    assert.ok(l.word && l.emoji, l.ch);
  }
});
