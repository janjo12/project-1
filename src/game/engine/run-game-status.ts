export function getTurnStatus({
  clearedLevels,
  hasRoomEnemy,
  hasLost,
  isResolving,
  level,
  roomId,
}: {
  clearedLevels: number;
  hasRoomEnemy: boolean;
  hasLost: boolean;
  isResolving: boolean;
  level: number;
  roomId: string;
}) {
  // Message precedence keeps terminal and resolving states from being described as ordinary room status.
  if (hasLost) return "You fell!";
  if (isResolving) return "Resolving turn...";
  if (hasRoomEnemy) return `Combat | Level ${level} | Room ${roomId}`;
  return `Room ${roomId} clear | Level ${level} | Cleared ${clearedLevels}`;
}
