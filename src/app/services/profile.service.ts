import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  AcademyProfileResponse,
  CreateAcademyProfileRequest,
  CreateStudentProfileRequest,
  ProfileMeResponse,
  ProfileResponse,
  StudentProfileResponse,
  TeacherProfileRequest,
  TeacherProfileResponse,
  UpdateAcademyProfileRequest,
  UpdateBaseProfileRequest,
  UpdateStudentProfileRequest,
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/profiles`;

  getMe() {
    return this.http.get<ProfileMeResponse>(`${this.base}/me`);
  }

  updateMe(request: UpdateBaseProfileRequest) {
    return this.http.patch<ProfileResponse>(`${this.base}/me`, request);
  }

  getById(userId: string) {
    return this.http.get<ProfileResponse>(`${this.base}/${userId}`);
  }

  // Student
  createStudentProfile(request: CreateStudentProfileRequest) {
    return this.http.post<StudentProfileResponse>(`${this.base}/student`, request);
  }

  updateStudentProfile(request: UpdateStudentProfileRequest) {
    return this.http.patch<StudentProfileResponse>(`${this.base}/student/me`, request);
  }

  getStudentProfile(userId: string) {
    return this.http.get<StudentProfileResponse>(`${this.base}/student/${userId}`);
  }

  // Teacher
  createTeacherProfile(request: TeacherProfileRequest) {
    return this.http.post<TeacherProfileResponse>(`${this.base}/teacher`, request);
  }

  updateTeacherProfile(request: TeacherProfileRequest) {
    return this.http.patch<TeacherProfileResponse>(`${this.base}/teacher/me`, request);
  }

  getMyTeacherProfile() {
    return this.http.get<TeacherProfileResponse>(`${this.base}/teacher/me`);
  }

  getTeacherProfile(userId: string) {
    return this.http.get<TeacherProfileResponse>(`${this.base}/teacher/${userId}`);
  }

  // Academy
  createAcademyProfile(request: CreateAcademyProfileRequest) {
    return this.http.post<AcademyProfileResponse>(`${this.base}/academy`, request);
  }

  updateAcademyProfile(request: UpdateAcademyProfileRequest) {
    return this.http.patch<AcademyProfileResponse>(`${this.base}/academy/me`, request);
  }

  getMyAcademyProfile() {
    return this.http.get<AcademyProfileResponse>(`${this.base}/academy/me`);
  }
}
