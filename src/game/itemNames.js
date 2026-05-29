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
      a: 'WIZARD', b: 'VIKING', c: 'SKULL', d: 'KNIGHT',
      e: 'ORC', f: 'ELF', g: 'MAGE', h: 'DEMON', i: 'ANGEL'
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
    }
  },
  es: {
    animal_cartoon: {
      a: 'MOLINILLO', b: 'PELOTA', c: 'BARCO', d: 'PATO',
      e: 'CARRO', f: 'AROS', g: 'TREN', h: 'OSO', i: 'TAMBOR'
    },
    mistic_lego: {
      a: 'MAGO', b: 'VIKINGO', c: 'CALAVERA', d: 'CABALLERO',
      e: 'ORCO', f: 'ELFO', g: 'BRUJO', h: 'DEMONIO', i: 'ÁNGEL'
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
    }
  }
}

/** Turn an asset key into a printable word in the given language. */
export function nameForAssetKey(assetKey, lang = 'en') {
  const match = /^asset_(.+)_([a-i])$/.exec(assetKey || '')
  if (!match) return ''
  const [, pack, letter] = match
  const table = ITEM_NAMES[lang] || ITEM_NAMES.en
  return table[pack]?.[letter] || ITEM_NAMES.en[pack]?.[letter] || ''
}
