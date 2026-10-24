export type PickupFlightPoint = { x: number; y: number };
export type PickupFlightActor = {
  contentSprite?: string | null;
  isChest?: boolean;
  kind: string;
  label: string;
};
export type PickupFlightRequest = {
  start: PickupFlightPoint;
  end: PickupFlightPoint;
  sprite: string;
  label: string;
};

export function requestPickupSpriteFlight(
  actor: PickupFlightActor,
  start: PickupFlightPoint,
  end: PickupFlightPoint,
  animate: (request: PickupFlightRequest) => void,
) {
  if (actor.isChest || !actor.contentSprite) return;
  animate({ start, end, sprite: actor.contentSprite, label: actor.label });
}
