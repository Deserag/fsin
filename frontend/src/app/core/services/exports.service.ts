import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ExportsService {
  constructor(private readonly http: HttpClient) {}

  async downloadStudents(filename = 'students.xlsx'): Promise<void> {
    const blob = await this.http.get(`${base}/exports/students`, { responseType: 'blob' }).toPromise();
    this.saveBlob(blob!, filename);
  }

  async downloadAttendance(params: Record<string, string>, filename = 'attendance.xlsx'): Promise<void> {
    const blob = await this.http.get(`${base}/exports/attendance`, { params, responseType: 'blob' }).toPromise();
    this.saveBlob(blob!, filename);
  }

  async downloadTemplate(filename = 'students-template.xlsx'): Promise<void> {
    const blob = await this.http.get(`${base}/imports/template`, { responseType: 'blob' }).toPromise();
    this.saveBlob(blob!, filename);
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
