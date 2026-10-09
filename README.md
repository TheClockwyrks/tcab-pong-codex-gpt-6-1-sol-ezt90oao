# Carom

A browser paddle duel built around spin and bank shots. Move your paddle as you
strike to curve the ball; use the two amber obstacles to outplay your opponent.
Play Solo against the computer or Versus with a friend on the same keyboard.
First to 11 wins, with a lead of two.

Requires Node.js and npm. Install with `npm ci`, then run `npm run dev` and open
the address Vite prints. `npm run build` produces the complete static site in
`dist/`; serve that directory from any static server. `npm run preview` previews
the production build locally. No server, external assets, or credentials are
needed during play.

- Solo: W / S or the up / down arrows.
- Versus: W / S for the left paddle, up / down arrows for the right.
- Menus: W / S or arrows to select; Enter / Space to confirm. Mouse and touch
  also select and confirm menu items.
- P / Escape: pause or resume. Escape also returns from the instructions.
- M: toggle sound. Backtick: engine diagnostics.
- Touch: the engine displays two paddle sliders and menu controls.

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` for
validation. Tests run the actual engine over a native canvas and counted clocks.
The simulation has no rendering dependency, and the engine's debug API exposes
immutable poses and snapshots for repeatable scenarios.

The `showcase/` directory contains screenshots, a recorded rally, and the player
facing description. All game graphics and sound cues are generated in code.
