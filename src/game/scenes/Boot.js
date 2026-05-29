import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height

    // Friendly background + primitive loading bar drawn BEFORE any asset
    // loads, so the player never stares at a blank screen and we don't
    // depend on a loaded image to draw the loader.
    this.cameras.main.setBackgroundColor('#5bb6ef')
    const barW = this.sWidth * 0.6
    const barH = Math.max(8, this.sHeight * 0.035)
    const barX = this.sWidth / 2
    const barY = this.sHeight / 2
    this.add.rectangle(barX, barY, barW, barH).setStrokeStyle(2, 0xffffff)
    const bar = this.add
      .rectangle(barX - barW / 2, barY, 4, barH - 4, 0xffffff)
      .setOrigin(0, 0.5)
    this.load.on('progress', (p) => {
      bar.width = 4 + (barW - 8) * p
    })

    // Load every game asset here in preload, unconditionally.
    //
    // The original Boot.js gated `loadGameAssets()` behind WebFont's `active`
    // callback. On a real iOS device / simulator the Google Fonts CDN often
    // fires `inactive` instead (cold network, ATS, timeout), and the assets
    // were never queued at all — leaving every scene with Phaser's __MISSING
    // texture (the green-outlined diagonal-line square).
    this.loadGameAssets()
  }

  create() {
    // Fonts are loaded via <link rel="stylesheet"> in index.html (standard
    // browser font loading, no WebFont.js). Wait briefly for them to arrive
    // so Phaser bakes them into text textures correctly — but never sit on
    // the Boot scene longer than 2s if the CDN is unreachable.
    const proceed = () => {
      // Generate the number-pack textures NOW (after fonts are ready) so the
      // baked-in digit glyphs use Fredoka — not the system fallback.
      this.generateNumberTextures()
      this.scene.start('MainMenu')
    }
    const fontsReady =
      typeof document !== 'undefined' && document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve()
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]).then(
      proceed
    )
  }

  /**
   * Bake nine `asset_numbers_<a-i>` textures — just the digit glyph (1-9),
   * no background chip. Each digit IS the shape so a toddler learns to
   * recognise the silhouette of "1", "2", "3"… and the matching shadow on
   * the starry-sky scene is the same silhouette ghosted out in moonlight.
   * Colours follow rainbow order 1→7, then pink + teal for 8 + 9.
   */
  generateNumberTextures() {
    const fills = [
      '#ff5d5d', '#ff9f1c', '#ffd23f', '#5fc34a', '#3ba4ff',
      '#6c4ad6', '#9b5de5', '#ff5da2', '#29c7b8'
    ]
    // Stroke a couple of shades darker than the fill — chunky outline that
    // gives each digit a 3-D-ish cookie-cutter feel without a background.
    const strokes = [
      '#7a1f1f', '#7a4400', '#856100', '#1a4f17', '#0e4b85',
      '#2a1a70', '#421e7a', '#871a4a', '#0b5b54'
    ]
    const size = 240
    const fontSize = Math.round(size * 0.88) // big — fills almost the whole texture

    for (let i = 0; i < 9; i++) {
      const digit = i + 1
      const letter = String.fromCharCode(97 + i)
      const key = `asset_numbers_${letter}`
      if (this.textures.exists(key)) continue

      const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)

      // Pass 1 — drop shadow. A black-tinted version of the glyph nudged
      // down a few pixels gives the digit physical weight on screen.
      const shadow = this.make.text({
        x: 0, y: 0,
        text: String(digit),
        style: {
          fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: 'rgba(0,0,0,0.32)',
          stroke: 'rgba(0,0,0,0.32)',
          strokeThickness: Math.round(size * 0.12)
        }
      })
      shadow.setOrigin(0.5)
      rt.draw(shadow, size / 2, size / 2 + size * 0.05)
      shadow.destroy()

      // Pass 2 — the digit itself. Bright fill + darker stroke = readable
      // and chunky enough for a toddler to recognise from across the room.
      const text = this.make.text({
        x: 0, y: 0,
        text: String(digit),
        style: {
          fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: fills[i],
          stroke: strokes[i],
          strokeThickness: Math.round(size * 0.1)
        }
      })
      text.setOrigin(0.5)
      rt.draw(text, size / 2, size / 2)
      text.destroy()

      rt.saveTexture(key)
      rt.destroy()
    }
  }

  loadGameAssets() {
    // BUTTONS
    this.load.image('button_back', 'assets/buttons/back.png')

    // BACKGROUNDS
    this.load.image('background_a', 'assets/backgrounds/A.png')
    this.load.image('background_b', 'assets/backgrounds/B.png')
    this.load.image('background_c', 'assets/backgrounds/C.png')
    this.load.image('background_d', 'assets/backgrounds/D.png')
    this.load.image('background_e', 'assets/backgrounds/E.png')

    // TOYS-CARTOON
    const animalCartoonPackName = 'animal_cartoon'
    const animalCartoonPath = 'A.png'
    const animalCartoonWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${animalCartoonPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${animalCartoonPath}`,
        {
          frameWidth: animalCartoonWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // MISTIC-LEGO
    const misticLegoPackName = 'mistic_lego'
    const misticLegoPath = 'B.png'
    const misticLegoWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${misticLegoPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${misticLegoPath}`,
        {
          frameWidth: misticLegoWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // EMOJIS-LEGO
    const emojisLegoPackName = 'emojis_lego'
    const emojisLegoPath = 'C.png'
    const emojisLegoWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${emojisLegoPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${emojisLegoPath}`,
        {
          frameWidth: emojisLegoWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // FRUITS — individual Fluent Emoji 3D PNGs (MIT). See public/assets/fruits/README.md.
    const fruitFiles = {
      a: 'red_apple',
      b: 'banana',
      c: 'tangerine',
      d: 'grapes',
      e: 'strawberry',
      f: 'watermelon',
      g: 'pineapple',
      h: 'cherries',
      i: 'pear'
    }
    for (const [letter, name] of Object.entries(fruitFiles)) {
      this.load.image(`asset_fruits_${letter}`, `assets/fruits/${letter}_${name}.png`)
    }

    // AUDIO — Kenney UI Audio (CC0). See public/assets/audio/ui/README.md
    // for the mapping of each file to where it plays.
    this.load.audio('ui_letter_pop', 'assets/audio/ui/click5.wav')
    this.load.audio('ui_match_drop', 'assets/audio/ui/switch7.wav')
    this.load.audio('ui_celebrate', 'assets/audio/ui/switch33.wav')
    this.load.audio('ui_menu_tap', 'assets/audio/ui/rollover3.wav')

    // Legacy aliases — kept so the old crateboy keys still resolve while the
    // codebase migrates. Points at the new Kenney files, not the crateboy WAVs.
    this.load.audio('collect', 'assets/audio/ui/switch7.wav')
    this.load.audio('sfx_collect', 'assets/audio/ui/click5.wav')

    // ELEMENTS
    this.load.image('cloud-b', 'assets/clouds/cloud-computing.png')
    this.load.image('cloud-c', 'assets/clouds/cloud.png')
    this.load.image('sky', 'assets/elements/sky.png')
    this.load.image('ground', 'assets/elements/platform.png')
    this.load.image('star', 'assets/elements/star.png')
    this.load.image('bomb', 'assets/elements/bomb.png')
    this.load.image('brick', 'assets/elements/brick.png')
    this.load.image('frameA', 'assets/crateboy/_ART/birds/spr_bird1_0.png')
    this.load.image('frameB', 'assets/crateboy/_ART/birds/spr_bird1_1.png')
    this.load.image('wall', 'assets/crateboy/_ART/Wall tiles/wall3.png')
  }
}
