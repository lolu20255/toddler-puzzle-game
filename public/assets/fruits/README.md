# Fruit assets

Source: [Microsoft Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji)
(3D variant) — **MIT licensed**. Picked the cute "plush" 3D style because it
plays nicely with the existing cartoon-outlined Toys / Heroes / Faces packs
while keeping its own personality (the bananas literally look like soft toys).

| Slot | File | Word taught |
|------|------|-------------|
| a | `a_red_apple.png` | APPLE |
| b | `b_banana.png` | BANANA |
| c | `c_tangerine.png` | ORANGE |
| d | `d_grapes.png` | GRAPES |
| e | `e_strawberry.png` | STRAWBERRY |
| f | `f_watermelon.png` | WATERMELON |
| g | `g_pineapple.png` | PINEAPPLE |
| h | `h_cherries.png` | CHERRY |
| i | `i_pear.png` | PEAR |

Loaded individually (not a sprite sheet) in `src/game/scenes/Boot.js`. Keyed
as `asset_fruits_<letter>` to match the existing pack-name convention used by
`itemNames.js`, `celebrate.js`, and the `GameD` scene.
