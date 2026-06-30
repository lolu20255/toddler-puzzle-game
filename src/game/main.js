import { Boot } from './scenes/Boot'
import { GameA } from './scenes/GameA'
import { GameB } from './scenes/GameB'
import { GameC } from './scenes/GameC'
import { GameD } from './scenes/GameD'
import { GameE } from './scenes/GameE'
import { GameF } from './scenes/GameF'
import { GameG } from './scenes/GameG'
import { GameH } from './scenes/GameH'
import { GameI } from './scenes/GameI'
import { GameJ } from './scenes/GameJ'
import { GameOver } from './scenes/GameOver'
import { MainMenu } from './scenes/MainMenu'
import { Settings } from './scenes/Settings'
import { installResponsive } from './responsive'
import Phaser from 'phaser'

// ──────────────────────────────────────────────────────────────────────────
// HiDPI / Retina sharpness
//
// Phaser's Scale.RESIZE creates a backing-store canvas at CSS pixel size.
// On an iPhone with devicePixelRatio 3, iOS then upscales that low-res
// canvas to 3× physical pixels — which is why every sprite looked pixelated
// on device. The recommended Phaser 3 fix is to render the game at
// `innerWidth × DPR` pixels and CSS-scale it back down with `zoom: 1/DPR`,
// so the backing store matches the physical screen 1:1 and the GPU draws
// every sprite at its native source resolution.
//
// Sources:
// - https://supernapie.com/blog/support-retina-with-phaser-3/
// - https://github.com/phaserjs/phaser/issues/3198
// - https://github.com/Quinten/phaser3-retina
//
// We cap DPR at 2 (not 3). At 3 the backing store on an iPhone Pro Max is
// 1290 × 2220 × 4 bytes ≈ 11 MB, plus mipmaps and decoded background
// textures — enough to push WKWebView's WebContent process over its memory
// limit on a real device, even though the iOS Simulator stays fine. Going
// from 3× to 2× drops canvas memory by ~55% and the visual difference is
// imperceptible.
// ──────────────────────────────────────────────────────────────────────────
const DPR = Math.min(window.devicePixelRatio || 1, 2)

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#b06923',
  scale: {
    // NONE (not RESIZE) because we set width/height ourselves in physical
    // pixels and let CSS `zoom` scale the canvas back to the viewport.
    mode: Phaser.Scale.NONE,
    width: Math.floor(window.innerWidth * DPR),
    height: Math.floor(window.innerHeight * DPR),
    zoom: 1 / DPR,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    // Smooth downscaling for the sprite-sheet icons that sit inside the
    // smaller card windows in MainMenu.
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR'
  },
  scene: [Boot, MainMenu, Settings, GameA, GameB, GameC, GameD, GameE, GameF, GameG, GameH, GameI, GameJ, GameOver],
  physics: {
    // Matter.js (bundled with Phaser) so the falling puzzle pieces collide by
    // their actual body shape and stack cleanly without ever overlapping —
    // Arcade only does axis-aligned rectangles/circles. gravity y:1 is Matter's
    // native "earth-normal" gravity, so pieces fall at a realistic rate.
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      debug: false
    }
  }
}

const StartGame = (parent) => {
  const game = new Phaser.Game({ ...config, parent })
  // Resize + reflow the live scene when the device flips orientation. The
  // canvas is Scale.NONE (fixed size), so without this it never adapts to
  // rotation. See responsive.js for why we restart rather than reposition.
  installResponsive(game)
  return game
}

export default StartGame
