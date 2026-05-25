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
    const proceed = () => this.scene.start('MainMenu')
    const fontsReady =
      typeof document !== 'undefined' && document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve()
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]).then(
      proceed
    )
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

    // AUDIO
    this.load.audio('collect', 'assets/crateboy/_AUDIO/collect.wav')
    this.load.audio('sfx_collect', 'assets/crateboy/_AUDIO/sfx_collect.wav')

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
