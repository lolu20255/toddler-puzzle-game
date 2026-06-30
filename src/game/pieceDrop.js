import Phaser from 'phaser'

// ──────────────────────────────────────────────────────────────────────────
// Falling puzzle pieces (Matter.js)
//
// Shared by the seven shadow-matching art-pack scenes (GameA–G). The draggable
// pieces are given Matter.js bodies so that on load they rain in from above the
// top edge, bounce off the floor, and — most importantly — separate by their
// actual body shape. Matter's solver guarantees two solid bodies never overlap:
// where there's room they settle side by side, where there isn't they stack one
// above another, but they never intersect. The toddler then drags each piece up
// onto its matching shadow.
//
// We use Matter (not Arcade) specifically because Arcade only supports
// axis-aligned rectangles/circles and its separation is poor for stacking.
// Matter gives clean, stable piles. Gravity comes from the game config
// (matter.gravity.y = 1, Matter's native earth-normal gravity).
// ──────────────────────────────────────────────────────────────────────────

const BOUNCE = 0.45 // restitution: a springy "double" bounce off the floor

// Each art frame carries transparent padding around the drawing, so we size the
// physics body (in display pixels) to roughly the visible artwork. Pieces then
// rest shape-to-shape instead of margin-to-margin.
const BODY_FILL_X = 0.85
const BODY_FILL_Y = 0.85

/**
 * Give the already-created, already-draggable pieces Matter bodies so they
 * fall, bounce, and never overlap. Call once at the end of a scene's
 * addAnimals(), after its own 'drag'/'dragend' listeners are registered,
 * passing the array of piece game objects.
 */
export function dropPieces(scene, pieces) {
  const w = scene.sWidth
  const h = scene.sHeight
  const n = pieces.length

  // Floor + left/right walls so pieces land and pile along the bottom. The TOP
  // is left open (top = false) so pieces can fall in from above the screen.
  scene.matter.world.setBounds(0, 0, w, h, 128, true, true, false, true)

  const laneW = w / n
  // Shuffle which lane each piece starts above so the layout looks random.
  const lanes = Phaser.Utils.Array.Shuffle(pieces.map((_, i) => i))

  pieces.forEach((piece, i) => {
    // Attach a rectangular Matter body sized to the visible art (display px).
    scene.matter.add.gameObject(piece, {
      shape: {
        type: 'rectangle',
        width: piece.displayWidth * BODY_FILL_X,
        height: piece.displayHeight * BODY_FILL_Y
      }
    })
    piece.setBounce(BOUNCE)
    piece.setFixedRotation() // stay upright; don't spin or tip over when landing

    // Start above a distinct lane at a staggered height so the pieces arrive as
    // a gentle shower; Matter then settles them with zero overlap.
    const x = Phaser.Math.Clamp(
      laneW * (lanes[i] + 0.5),
      piece.displayWidth / 2,
      w - piece.displayWidth / 2
    )
    const y = -piece.displayHeight - i * piece.displayHeight * 1.1
    // For a Matter game object, setting x/y moves the body too (Matter
    // Transform component), so the scene's drag handler keeps working unchanged.
    piece.setPosition(x, y)
  })

  // Drag handling: a held piece becomes static so it tracks the finger exactly
  // and ignores gravity (the scene's own 'drag' handler already sets piece.x/y,
  // which moves the static body). On release, a misdrop turns dynamic and falls
  // back into the pile; a correctly placed (locked / non-interactive) piece
  // stays static, frozen exactly where the scene snapped it onto its shadow.
  scene.input.on('dragstart', (pointer, obj) => {
    if (!obj.body) return
    obj.setStatic(true)
    obj.setDepth(3) // ride above the pile while dragging
  })

  scene.input.on('dragend', (pointer, obj) => {
    if (!obj.body) return
    obj.setDepth(2)
    // disableInteractive() (called by the scene when a piece lands on its
    // shadow) nulls / disables obj.input — that's our "locked" signal.
    const locked = !obj.input || obj.input.enabled === false
    if (!locked) {
      obj.setStatic(false)
      obj.setFixedRotation() // setStatic(false) restores inertia; re-lock it
    }
  })
}
