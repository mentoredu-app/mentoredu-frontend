import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Area, Career, Course, University,
  CreateUniversityRequest, CreateAreaRequest, CreateCourseRequest, CreateCareerRequest,
} from '../models/catalog.model';

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

  // ── Fresh reads (sin caché) — para el panel de administración ──────────────
  getUniversitiesFresh(): Observable<University[]> {
    return this.http.get<University[]>(`${this.base}/universities`);
  }

  getAreasByUniversityFresh(universityId: string): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.base}/universities/${universityId}/areas`);
  }

  getCareersByUniversityFresh(universityId: string): Observable<Career[]> {
    return this.http.get<Career[]>(`${this.base}/universities/${universityId}/careers`);
  }

  getCoursesFresh(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.base}/courses`);
  }

  // ── Mutations (solo ADMIN) ─────────────────────────────────────────────────
  createUniversity(req: CreateUniversityRequest): Observable<University> {
    return this.http.post<University>(`${this.base}/universities`, req);
  }

  createArea(universityId: string, req: CreateAreaRequest): Observable<Area> {
    return this.http.post<Area>(`${this.base}/universities/${universityId}/areas`, req);
  }

  createCourse(req: CreateCourseRequest): Observable<Course> {
    return this.http.post<Course>(`${this.base}/courses`, req);
  }

  linkCourseToArea(areaId: string, courseId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/areas/${areaId}/courses/${courseId}`, null);
  }

  createCareer(universityId: string, req: CreateCareerRequest): Observable<Career> {
    return this.http.post<Career>(`${this.base}/universities/${universityId}/careers`, req);
  }
}
