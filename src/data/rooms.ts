import type { RoomShape } from "../logic/grid";

export interface RoomDef extends RoomShape {
  id: string;
  name: string;
}

export const BEDROOM: RoomDef = { id: "bedroom", name: "Bedroom", columns: 12, wallRows: 3, floorRows: 3 };

export const ROOMS: Record<string, RoomDef> = { [BEDROOM.id]: BEDROOM };
