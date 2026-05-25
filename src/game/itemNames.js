/**
 * Friendly names for each puzzle piece, per art pack.
 *
 * Asset keys look like `asset_<pack>_<letter>` (e.g. `asset_animal_cartoon_e`).
 * Words are kept short and concrete so they're useful for a 2-4-year-old
 * learning English.
 */
export const ITEM_NAMES = {
  // pack A.png — toys
  animal_cartoon: {
    a: 'PINWHEEL',
    b: 'BALL',
    c: 'BOAT',
    d: 'DUCK',
    e: 'CAR',
    f: 'RINGS',
    g: 'TRAIN',
    h: 'BEAR',
    i: 'DRUM'
  },
  // pack B.png — fantasy lego heroes
  mistic_lego: {
    a: 'WIZARD',
    b: 'VIKING',
    c: 'SKULL',
    d: 'KNIGHT',
    e: 'ORC',
    f: 'ELF',
    g: 'MAGE',
    h: 'DEMON',
    i: 'ANGEL'
  },
  // pack C.png — emoji shapes
  emojis_lego: {
    a: 'HAPPY',
    b: 'ANGRY',
    c: 'CRY',
    d: 'SAD',
    e: 'LOVE',
    f: 'SMILE',
    g: 'COOL',
    h: 'GRIN',
    i: 'KISS'
  }
}

/** Turn an asset key into a printable word, or '' if unknown. */
export function nameForAssetKey(assetKey) {
  const match = /^asset_(.+)_([a-i])$/.exec(assetKey || '')
  if (!match) return ''
  const [, pack, letter] = match
  return ITEM_NAMES[pack]?.[letter] || ''
}
