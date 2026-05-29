export interface University {
  id: string;
  name: string;
  city?: string;
}

export interface Area {
  id: string;
  name: string;
  description?: string;
  universityId: string;
}

export interface Career {
  id: string;
  name: string;
  description?: string;
  universityId: string;
  areaId: string;
}

export interface Course {
  id: string;
  name: string;
}
