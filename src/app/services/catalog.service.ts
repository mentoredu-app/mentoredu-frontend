import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Area, Career, Course, University } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog`;

  // Caché a nivel de servicio singleton — cada endpoint se llama una sola vez por sesión
  private readonly universities$ = this.http.get<University[]>(`${this.base}/universities`).pipe(shareReplay(1));
  private readonly allCourses$ = this.http.get<Course[]>(`${this.base}/courses`).pipe(shareReplay(1));
  private readonly areasByUniversity = new Map<string, Observable<Area[]>>();
  private readonly careersByUniversity = new Map<string, Observable<Career[]>>();
  private readonly coursesByArea = new Map<string, Observable<Course[]>>();

  getUniversities(): Observable<University[]> {
    return this.universities$;
  }

  getAreasByUniversity(universityId: string): Observable<Area[]> {
    if (!this.areasByUniversity.has(universityId)) {
      this.areasByUniversity.set(
        universityId,
        this.http.get<Area[]>(`${this.base}/universities/${universityId}/areas`).pipe(shareReplay(1))
      );
    }
    return this.areasByUniversity.get(universityId)!;
  }

  getCareersByUniversity(universityId: string): Observable<Career[]> {
    if (!this.careersByUniversity.has(universityId)) {
      this.careersByUniversity.set(
        universityId,
        this.http.get<Career[]>(`${this.base}/universities/${universityId}/careers`).pipe(shareReplay(1))
      );
    }
    return this.careersByUniversity.get(universityId)!;
  }

  getCoursesByArea(areaId: string): Observable<Course[]> {
    if (!this.coursesByArea.has(areaId)) {
      this.coursesByArea.set(
        areaId,
        this.http.get<Course[]>(`${this.base}/areas/${areaId}/courses`).pipe(shareReplay(1))
      );
    }
    return this.coursesByArea.get(areaId)!;
  }

  getAllCourses(): Observable<Course[]> {
    return this.allCourses$;
  }
}
