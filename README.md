## Project map

This repository has two app shells backed by shared game rules:

- `src/app/` is the Expo Router app used on Android and iOS. `index.tsx` is the title screen, `setup.tsx` configures a run, and `game.tsx` is the single-player screen.
- `app/` is the Next.js browser app. `page.tsx` owns navigation state, while `RunScreens.tsx` contains setup, settings, and single-player screens.
- `src/game/` contains shared rules and state. Start with `src/game/README.md`; balance values live in `config/gameparameters.js`, class behavior/text in `config/game-classes.ts`, and multiplayer turn resolution in `engine/run-game-multiplayer.ts`.
- `src/components/` contains shared UI. Files ending in `.web.tsx` are browser-specific implementations selected by the web bundler; check the matching native file when changing a shared component.
- `src/multiplayer/` contains the WebRTC connection adapters and its README covers setup and limitations.
- `tests/unit/` contains the Jest tests, and `tests/visual/` contains Playwright browser checks.

## Change map and duplication

- The single-player game screen exists in both `src/app/game.tsx` and `app/RunScreens.tsx`. Gameplay UI changes generally need to be applied to both; shared game rules should go in `src/game/` instead.
- Both platforms use `src/game/engine/use-game-loop-driver.ts` to advance the shared game loop and turn clock. Keep timer behavior in the shared driver and rules rather than adding screen-local timer implementations.
- Native and web variants are also present for `ScreenShell`, `ActionButton`, `Walls`, `PlayerHUD`, and `EnemyFeedback`; keep their behavior aligned where the user-facing component is shared.
- Game tuning has a central table in `src/game/config/gameparameters.js`, but class details live separately in `src/game/config/game-classes.ts`. Search both before changing balance or player-facing class descriptions.

## Local development

- Run the Next.js browser version with `npm run dev`, then open `http://localhost:3100`. Changes refresh locally without waiting for a Vercel deployment.
- Before pushing browser changes, run `npm run web:build` and `npm run test:smoke` for a fast production-build and new-run check. `npm run test:visual` runs the full browser suite.
- Run the Expo app with `npm start`. With an Android emulator open, press `a` in the Expo terminal to launch the app in Expo Go. Singleplayer is supported there; WebRTC is loaded only when multiplayer is selected.
- For a native Android development build, start an emulator in Android Studio and run `npm run android`. This is required to try multiplayer because Expo Go does not include `react-native-webrtc`. Multiplayer can still fail on a device or emulator without compatible WebRTC support or when the Wi-Fi/router blocks local device traffic; the game reports recovery guidance and offers a direct singleplayer fallback.
- Check `adb devices` if Expo cannot find the emulator. The emulator must be running and listed before the native build can be installed.

## Wireframe

![Wireframe](wireframe-project-1.png)


## HIG and Material Design:

- HIG Game Design says you should be capable of playing right after installing, you should figure out how to play with playable tutorials rather than text explanations, and the default settings should be best for most users (https://developer.apple.com/design/human-interface-guidelines/designing-for-games). My project is so simple you can start playing immediately, there's no written tutorial you must go through when starting, and the default settings assume a desire for moderate difficulty, not having a specific seed in mind, and right-handedness.
- Material Design for Buttons says that each screen should have one prominent button for that screen's primary action, and that this primary button should be a filled button, which is a button where the text matches the screen background and the rest of the button is filled in with another color. (https://m3.material.io/components/all-buttons). I follow this with the "Start" and "Return to Title" buttons on the landing screen and game over screen, respectively, but deviate for the gameplay screen because no one game action is dominant, so there are several buttons of equal weight and emphasis instead of one primary action. It also says that segmented buttons, like the (currently non-functional) segmented button used for selecting game difficulty from the landing screen, should have between 2 and 5 options and have short, succinct labels (https://m3.material.io/components/segmented-buttons/guidelines), which the difficulty segmented button does.

## HIG and Material Design, Part II
- Human Interface Guidelines says that there are four button roles - Primary for the non-destructive thing the user is most likely to do, Destructive for actions that can result in deleting things, Cancel to cancel the current action, and Normal for everything - and that Primary buttons should use the app's accent color, while Destructive buttons should use the app's main red. It also says that Help buttons should be circular, consistently sized buttons with a question mark inside that display relevant documentation when pressed, with no more than one help button per window (https://developer.apple.com/design/human-interface-guidelines/buttons). I use the four main buttons roles in my app, Primary for things like "Start Game" and "Return to Title," Destructive for "Quit to Title" (since that destroys your run data), cancel for quitting out of the "Quit to Title" button, and normal buttons for settings and such. I use help buttons that are cicular, with question marks, and pull up relevant documentation, but I use multiple on the home screen for the different main game settings, since I wanted separate documentation for each and I feel their placement makes it clear enough what each is helping you with.

## Other Packages:

- Expo Vector Icons - used for health, energy, and direction buttons on the game screen.
- Expo Haptics - makes the phone vibrate when the player takes damage.
- React Native Game Engine - Helps with rendering and updating the screen with animations.
