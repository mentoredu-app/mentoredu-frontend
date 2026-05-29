import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Area, Career, Course, University } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog`;

  getUniversities() {
    return this.http.get<University[]>(`${this.base}/universities`);
  }

  getAreasByUniversity(universityId: string) {
    return this.http.get<Area[]>(`${this.base}/universities/${universityId}/areas`);
  }

  getCareersByUniversity(universityId: string) {
    return this.http.get<Career[]>(`${this.base}/universities/${universityId}/careers`);
  }

  getCoursesByArea(areaId: string) {
    return this.http.get<Course[]>(`${this.base}/areas/${areaId}/courses`);
  }

  getAllCourses() {
    return this.http.get<Course[]>(`${this.base}/courses`);
  }
}
