import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/common.model';
import {
  CreateVerificationRequest,
  ReviewVerificationRequest,
  VerificationResponse,
} from '../models/community.model';
import { AssociatedMemberResponse, AssociationResponse } from '../models/association.model';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private http = inject(HttpClient);
  private readonly usersBase         = `${environment.apiUrl}/users`;
  private readonly verificationBase  = `${environment.apiUrl}/verification`;
  private readonly associationsBase  = `${environment.apiUrl}/associations/teacher-academy`;

  toggleFollow(userId: string) {
    return this.http.post<void>(
      `${this.usersBase}/${userId}/follow`,
      {},
      { observe: 'response' }
    );
  }

  requestVerification(request: CreateVerificationRequest): Observable<VerificationResponse> {
    return this.http.post<VerificationResponse>(`${this.verificationBase}/requests`, request);
  }

  getMyVerifications(page = 0, size = 10): Observable<PagedResponse<VerificationResponse>> {
    return this.http.get<PagedResponse<VerificationResponse>>(
      `${this.verificationBase}/requests/me`,
      { params: { page, size } }
    );
  }

  getAllVerifications(page = 0, size = 20): Observable<PagedResponse<VerificationResponse>> {
    return this.http.get<PagedResponse<VerificationResponse>>(
      `${this.verificationBase}/requests`,
      { params: { page, size } }
    );
  }

  reviewVerification(id: string, request: ReviewVerificationRequest): Observable<VerificationResponse> {
    return this.http.patch<VerificationResponse>(
      `${this.verificationBase}/requests/${id}/review`,
      request
    );
  }

  // ── Associations teacher-academy ─────────────────────────────────────────
  requestAssociation(academyProfileId: string): Observable<AssociationResponse> {
    return this.http.post<AssociationResponse>(this.associationsBase, { academyProfileId });
  }

  getMyAssociations(): Observable<AssociationResponse[]> {
    return this.http.get<AssociationResponse[]>(`${this.associationsBase}/me`);
  }

  getAcademyRequests(): Observable<AssociationResponse[]> {
    return this.http.get<AssociationResponse[]>(`${this.associationsBase}/academy`);
  }

  acceptAssociation(id: string): Observable<AssociationResponse> {
    return this.http.patch<AssociationResponse>(`${this.associationsBase}/${id}/accept`, {});
  }

  rejectAssociation(id: string): Observable<AssociationResponse> {
    return this.http.patch<AssociationResponse>(`${this.associationsBase}/${id}/reject`, {});
  }

  getTeachersOfAcademy(userId: string): Observable<AssociatedMemberResponse[]> {
    return this.http.get<AssociatedMemberResponse[]>(
      `${this.associationsBase}/academy/${userId}/teachers`
    );
  }

  getAcademiesOfTeacher(userId: string): Observable<AssociatedMemberResponse[]> {
    return this.http.get<AssociatedMemberResponse[]>(
      `${this.associationsBase}/teacher/${userId}/academies`
    );
  }
}
