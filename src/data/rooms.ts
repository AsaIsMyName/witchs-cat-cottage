import type { RoomShape } from "../logic/grid";

export interface RoomDef extends RoomShape {
  id: string;
  name: string;
}

export const BEDROOM: RoomDef = { id: "bedroom", name: "Bedroom", columns: 16, wallRows: 2, floorRows: 9 };

export const ROOMS: Record<string, RoomDef> = { [BEDROOM.id]: BEDROOM };
