import Phaser from 'phaser'

// ──────────────────────────────────────────────────────────────────────────
// Falling puzzle pieces
//
// Shared by the four shadow-matching art-pack scenes (GameA/B/C/D). The
// draggable pieces used to be sprinkled at random positions, which let them
// overlap and stack on top of each other. Here we turn each piece into an
// arcade-physics body so that on load they rain in from above the top edge,
// bounce a little, collide with one another (so none ever overlaps another),
// and settle into a tidy pile along the bottom of the screen. The toddler
// then drags each piece up onto its matching shadow.
//
// "Earth gravity": the arcade world has no inherent length scale, so 9.81
// m/s² only means something once we decide how many real-world metres the
// screen represents. We treat the full visible height as ~4.5 m of fall and
// derive pixels-per-metre from that. The acceleration stays physically exact
// (9.81 m/s²); the mapping just makes the apparent top-to-bottom fall (~1 s)
// feel natural on any device, big or small.
// ──────────────────────────────────────────────────────────────────────────

const EARTH_G = 9.81 // metres / second²
const SCREEN_METRES = 4.5 // how tall the visible screen "is", in metres
const BOUNCE = 0.45 // springy "double" bounce off the floor

/**
 * Set this scene's arcade gravity to real Earth gravity, scaled to the
 * screen's pixel size so the fall reads naturally regardless of device DPR.
 */
export function applyEarthGravity(scene) {
  const pixelsPerMetre = scene.sHeight / SCREEN_METRES
  scene.physics.world.gravity.y = EARTH_G * pixelsPerMetre
}

// How much of each frame the artwork actually fills. The Fluent-3D / lego
// sprites carry transparent padding around the drawing, so a full-frame body
// would leave big gaps between pieces. We shrink the physics body to roughly
// the visible art so neighbours rest shape-to-shape instead of margin-to-margin.
// (Arcade only does rectangles/circles — no per-pixel collision — so this is
// the practical "respect the shape" knob; see pieceDrop notes.)
const BODY_FILL_X = 0.78
const BODY_FILL_Y = 0.9

/**
 * Give the already-created, already-draggable pieces physics so they fall,
 * bounce, and push each other apart. A collider guarantees no two pieces ever
 * overlap: where there's room they settle side by side, and where there isn't
 * they stack one above another — but their bodies never intersect. Call once at
 * the end of a scene's addAnimals(), after its own 'drag'/'dragend' listeners
 * are registered, passing the array of piece game objects.
 */
export function dropPieces(scene, pieces) {
  applyEarthGravity(scene)

  const w = scene.sWidth
  const n = pieces.length
  const laneW = w / n
  // Shuffle which lane each piece starts above so the layout looks random.
  const lanes = Phaser.Utils.Array.Shuffle(pieces.map((_, i) => i))

  pieces.forEach((piece, i) => {
    scene.physics.add.existing(piece)
    const body = piece.body
    body.setCollideWorldBounds(true) // rest on the bottom + side edges
    body.setBounce(BOUNCE)
    // Tighten the body to the visible artwork (source-texture pixels; a dynamic
    // Arcade body tracks the sprite's setScale automatically in Phaser 3.60+).
    body.setSize(piece.width * BODY_FILL_X, piece.height * BODY_FILL_Y, true)

    // Start each piece above a distinct lane at a staggered height so they fall
    // as a gentle shower; the collider then settles them with zero overlap.
    const x = Phaser.Math.Clamp(
      laneW * (lanes[i] + 0.5),
      piece.displayWidth / 2,
      w - piece.displayWidth / 2
    )
    const y = -piece.displayHeight - i * piece.displayHeight * 1.1
    body.reset(x, y)
  })

  // The guarantee: pieces separate on contact, so none can ever sit on top of
  // (overlap) another. They may stack, but their bodies never intersect.
  scene.physics.add.collider(pieces, pieces)

  // While a piece is held it should track the finger exactly and ignore
  // gravity. These listeners are registered after the scene's own drag
  // handlers, so the scene has already clamped piece.x/piece.y by the time we
  // sync the body to it.
  scene.input.on('dragstart', (pointer, obj) => {
    if (!obj.body) return
    obj.body.setAllowGravity(false)
    obj.body.setVelocity(0, 0)
    obj.body.setImmovable(true) // falling pieces can't shove the held one
    obj.setDepth(3) // ride above the pile while dragging
  })

  scene.input.on('drag', (pointer, obj) => {
    if (!obj.body) return
    obj.body.reset(obj.x, obj.y)
  })

  scene.input.on('dragend', (pointer, obj) => {
    if (!obj.body) return
    obj.setDepth(2)
    // The scene calls disableInteractive() when a piece lands on its shadow,
    // which nulls obj.input — that's our "correctly placed / locked" signal.
    const locked = !obj.input || obj.input.enabled === false
    if (locked) {
      // Freeze it exactly where the scene snapped it onto the shadow.
      obj.body.reset(obj.x, obj.y)
      obj.body.setAllowGravity(false)
      obj.body.setImmovable(true)
    } else {
      // Misdrop: let it fall back down and rejoin the pile.
      obj.body.setImmovable(false)
      obj.body.setAllowGravity(true)
    }
  })
}
