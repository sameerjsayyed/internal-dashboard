import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

export interface UploadHistory {
  id: number;
  file_name: string;
  file_size_kb: number;
  uploaded_at: string;
}

export interface ReportData {
  taskWise: { columns: string[]; data: any[] };
  resourceWise: { columns: string[]; data: any[] };
  consolidated: { columns: string[]; data: any[] };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = API_CONFIG.BASE_URL;

  constructor(private http: HttpClient) {}

  uploadFile(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}${API_CONFIG.ENDPOINTS.UPLOAD}`, formData, {
      reportProgress: true,
      observe: 'events',
    });
  }

  getUploadById(id: number): Observable<ReportData> {
    return this.http.get<ReportData>(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HISTORY_BY_ID(id)}`);
  }

  getUploadHistory(): Observable<UploadHistory[]> {
    return this.http.get<UploadHistory[]>(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HISTORY}`);
  }

  // getLatestUpload(): Observable<UploadHistory> {
  //   return this.http.get<UploadHistory>(`${this.baseUrl}/history/latest`);
  // }

  getLatestUpload(): Observable<UploadHistory & { revenue?: any }> {
    return this.http.get<UploadHistory & { revenue?: any }>(
      `${this.baseUrl}${API_CONFIG.ENDPOINTS.HISTORY_LATEST}`
    );
  }

  getReportByUploadId(id: number): Observable<ReportData> {
    return this.http.get<ReportData>(`${this.baseUrl}${API_CONFIG.ENDPOINTS.REPORT_BY_ID(id)}`);
  }

  //RPH changes
  getRPH(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}${API_CONFIG.ENDPOINTS.RPH}`);
  }

  saveRPH(data: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}${API_CONFIG.ENDPOINTS.RPH}`, data);
  }

  updateRPH(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}${API_CONFIG.ENDPOINTS.RPH_BY_ID(id)}`, data);
  }

  deleteRPH(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}${API_CONFIG.ENDPOINTS.RPH_BY_ID(id)}`);
  }

  //REVENUE
  getLatestRevenue(): Observable<any> {
    return this.http.get(`${this.baseUrl}${API_CONFIG.ENDPOINTS.REVENUE_LATEST}`);
  }

  // Past Reports methods
  deleteUploadHistory(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HISTORY_BY_ID(id)}`);
  }

  clearAllUploadHistory(): Observable<any> {
    return this.http.delete(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HISTORY}`);
  }
}
