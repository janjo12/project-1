## Wireframe:

![Wireframe](wireframe-project-1.png)


## HIG and Material Design:

- HIG Game Design says you should be capable of playing right after installing, you should figure out how to play with playable tutorials rather than text explanations, and the default settings should be best for most users (https://developer.apple.com/design/human-interface-guidelines/designing-for-games). My project is so simple you can start playing immediately, there's no written tutorial you must go through when starting, and the default settings assume a desire for moderate difficulty, not having a specific seed in mind, and right-handedness.
- Material Design for Buttons says that each screen should have one prominent button for that screen's primary action, and that this primary button should be a filled button, which is a button where the text matches the screen background and the rest of the button is filled in with another color. (https://m3.material.io/components/all-buttons). I follow this with the "Start" and "Return to Title" buttons on the landing screen and game over screen, respectively, but deviate for the gameplay screen because no one game action is dominant, so there are several buttons of equal weight and emphasis instead of one primary action. It also says that segmented buttons, like the (currently non-functional) segmented button used for selecting game difficulty from the landing screen, should have between 2 and 5 options and have short, succinct labels (https://m3.material.io/components/segmented-buttons/guidelines), which the difficulty segmented button does.

## HIG and Material Design, Part II
- 

## Other Packages:

- Expo Vector Icons - used for health, energy, and direction buttons on the game screen.
- Expo Haptics - makes the phone vibrate when the player takes damage.
- React Native Game Engine - Helps with rendering and updating the screen with animations.