import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private http = inject(HttpClient);
  private readonly usersBase = `${environment.apiUrl}/users`;

  toggleFollow(userId: string) {
    return this.http.post<void>(
      `${this.usersBase}/${userId}/follow`,
      {},
      { observe: 'response' }
    );
  }
}
