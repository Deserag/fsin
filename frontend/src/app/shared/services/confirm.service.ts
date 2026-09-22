import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  ask(req: ConfirmRequest): Promise<boolean> {
    this.request.set(req);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  resolve(result: boolean): void {
    this.request.set(null);
    this.resolver?.(result);
    this.resolver = null;
  }
}
