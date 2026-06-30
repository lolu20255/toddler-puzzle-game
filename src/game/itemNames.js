/**
 * Friendly names for each puzzle piece, per art pack, per language.
 *
 * Asset keys look like `asset_<pack>_<letter>` (e.g. `asset_animal_cartoon_e`).
 * Words are short and concrete so they're useful for a 2-4-year-old learning
 * English or Spanish.
 */
export const ITEM_NAMES = {
  en: {
    // pack A.png — toys
    animal_cartoon: {
      a: 'PINWHEEL', b: 'BALL', c: 'BOAT', d: 'DUCK',
      e: 'CAR', f: 'RINGS', g: 'TRAIN', h: 'BEAR', i: 'DRUM'
    },
    // pack B.png — fantasy lego heroes
    mistic_lego: {
      a: 'WIZARD', b: 'VIKING', c: 'PIRATE', d: 'KNIGHT',
      e: 'ORC', f: 'ELF', g: 'MAGE', h: 'FAIRY', i: 'ANGEL'
    },
    // pack C.png — emoji shapes
    emojis_lego: {
      a: 'HAPPY', b: 'ANGRY', c: 'CRY', d: 'SAD',
      e: 'LOVE', f: 'SMILE', g: 'COOL', h: 'GRIN', i: 'KISS'
    },
    // Fluent Emoji 3D fruits (individual PNGs in public/assets/fruits/)
    fruits: {
      a: 'APPLE', b: 'BANANA', c: 'ORANGE', d: 'GRAPES',
      e: 'STRAWBERRY', f: 'WATERMELON', g: 'PINEAPPLE', h: 'CHERRY', i: 'PEAR'
    },
    // pack E (procedural) — digits 1-9 spoken as words for TTS spelling
    numbers: {
      a: 'ONE', b: 'TWO', c: 'THREE', d: 'FOUR',
      e: 'FIVE', f: 'SIX', g: 'SEVEN', h: 'EIGHT', i: 'NINE'
    },
    // Count game (GameJ) audio — same number words, but spoken bare ("One!")
    // with NO letter spelling. Listed in WORD_ONLY_PACKS below so the phrase
    // builders skip the "O, N, E." prefix that the Numbers shadow pack uses.
    count: {
      a: 'ONE', b: 'TWO', c: 'THREE', d: 'FOUR', e: 'FIVE',
      f: 'SIX', g: 'SEVEN', h: 'EIGHT', i: 'NINE', j: 'TEN'
    },
    // pack F (procedural) — first 9 letters of the alphabet, spoken as
    // their letter name. celebrate.js treats single-char phrases specially
    // (no spelling prefix) so the audio is just "A!" not "A. A!".
    letters: {
      a: 'A', b: 'B', c: 'C', d: 'D',
      e: 'E', f: 'F', g: 'G', h: 'H', i: 'I'
    },
    // pack G (procedural) — basic geometric shapes a toddler should learn.
    // Multi-character so the celebration spelling kicks in: "C,I,R,C,L,E. CIRCLE!"
    // gives them spelling + word pronunciation in one playback.
    shapes: {
      a: 'CIRCLE', b: 'SQUARE', c: 'TRIANGLE', d: 'RECTANGLE',
      e: 'STAR', f: 'HEART', g: 'DIAMOND', h: 'HEXAGON', i: 'OVAL'
    }
  },
  es: {
    animal_cartoon: {
      a: 'MOLINILLO', b: 'PELOTA', c: 'BARCO', d: 'PATO',
      e: 'CARRO', f: 'AROS', g: 'TREN', h: 'OSO', i: 'TAMBOR'
    },
    mistic_lego: {
      a: 'MAGO', b: 'VIKINGO', c: 'PIRATA', d: 'CABALLERO',
      e: 'ORCO', f: 'ELFO', g: 'BRUJO', h: 'HADA', i: 'ÁNGEL'
    },
    emojis_lego: {
      a: 'FELIZ', b: 'ENOJADO', c: 'LLORA', d: 'TRISTE',
      e: 'AMOR', f: 'SONRISA', g: 'GENIAL', h: 'RISA', i: 'BESO'
    },
    fruits: {
      a: 'MANZANA', b: 'PLÁTANO', c: 'NARANJA', d: 'UVAS',
      e: 'FRESA', f: 'SANDÍA', g: 'PIÑA', h: 'CEREZA', i: 'PERA'
    },
    numbers: {
      a: 'UNO', b: 'DOS', c: 'TRES', d: 'CUATRO',
      e: 'CINCO', f: 'SEIS', g: 'SIETE', h: 'OCHO', i: 'NUEVE'
    },
    // Count game (GameJ) audio — bare number words, no spelling. See en.count.
    count: {
      a: 'UNO', b: 'DOS', c: 'TRES', d: 'CUATRO', e: 'CINCO',
      f: 'SEIS', g: 'SIETE', h: 'OCHO', i: 'NUEVE', j: 'DIEZ'
    },
    letters: {
      a: 'A', b: 'B', c: 'C', d: 'D',
      e: 'E', f: 'F', g: 'G', h: 'H', i: 'I'
    },
    shapes: {
      a: 'CÍRCULO', b: 'CUADRADO', c: 'TRIÁNGULO', d: 'RECTÁNGULO',
      e: 'ESTRELLA', f: 'CORAZÓN', g: 'ROMBO', h: 'HEXÁGONO', i: 'ÓVALO'
    }
  }
}

// Packs whose audio is the bare word, NOT spelled out letter-by-letter. The
// Count game says "One!", "Two!"; spelling numbers ("O, N, E…") is wrong for
// counting. (The Letters pack is handled separately by the single-character
// rule in the phrase builders.) Shared by the runtime (levelAudio.js) and the
// batch generator (generate-level-audios.mjs) so both build the same phrase.
export const WORD_ONLY_PACKS = new Set(['count'])

/** True if `pack`'s audio should be the plain word with no spelling prefix. */
export function isWordOnlyPack(pack) {
  return WORD_ONLY_PACKS.has(pack)
}

/** Turn an asset key into a printable word in the given language. */
export function nameForAssetKey(assetKey, lang = 'en') {
  const match = /^asset_(.+)_([a-j])$/.exec(assetKey || '')
  if (!match) return ''
  const [, pack, letter] = match
  const table = ITEM_NAMES[lang] || ITEM_NAMES.en
  return table[pack]?.[letter] || ITEM_NAMES.en[pack]?.[letter] || ''
}
