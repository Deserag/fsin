import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ParseResult {
  jobId: string;
  headers: string[];
  totalRows: number;
  previewData: Record<string, unknown>[];
}

export interface ValidateResult {
  jobId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: { row: number; field: string; message: string; value: string }[];
}

export interface ConfirmResult {
  jobId: string;
  importedRows: number;
  errorRows: number;
}

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ImportsService {
  constructor(private readonly http: HttpClient) {}

  downloadTemplateUrl(): string {
    return `${base}/imports/template`;
  }

  parse(file: File): Observable<ParseResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ParseResult>(`${base}/imports/students/parse`, form);
  }

  setMapping(jobId: string, mapping: Record<string, string>): Observable<unknown> {
    return this.http.post(`${base}/imports/students/mapping`, { jobId, mapping });
  }

  validate(jobId: string): Observable<ValidateResult> {
    return this.http.post<ValidateResult>(`${base}/imports/students/validate`, { jobId });
  }

  confirm(jobId: string): Observable<ConfirmResult> {
    return this.http.post<ConfirmResult>(`${base}/imports/students/confirm`, { jobId });
  }
}
