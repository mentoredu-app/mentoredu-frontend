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

export interface CreateUniversityRequest { name: string; city?: string; }
export interface CreateAreaRequest { name: string; description?: string; }
export interface CreateCourseRequest { name: string; }
export interface CreateCareerRequest { areaId: string; name: string; description?: string; }
