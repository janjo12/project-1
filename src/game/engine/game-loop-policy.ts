export type RunGameLoopPolicy = {
  running: boolean;
  pauseMenuOpen?: boolean;
  itemMenuOpen?: boolean;
  equipmentMenuOpen?: boolean;
  mapOpen?: boolean;
  microgameActive?: boolean;
  classIntroOpen?: boolean;
};

export function isRunGameLoopEnabled({
  running,
  pauseMenuOpen = false,
  itemMenuOpen = false,
  equipmentMenuOpen = false,
  mapOpen = false,
  microgameActive = false,
  classIntroOpen = false,
}: RunGameLoopPolicy) {
  return running && !pauseMenuOpen && !itemMenuOpen && !equipmentMenuOpen && !mapOpen && !microgameActive && !classIntroOpen;
}
