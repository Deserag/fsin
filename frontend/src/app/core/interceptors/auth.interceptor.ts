import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { environment } from '../../../environments/environment';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
 const auth = inject(AuthService), toast = inject(ToastService);
 if (!req.url.startsWith(environment.apiUrl + '/')) return next(req);
 const request = auth.token ? req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } }) : req;
 return next(request).pipe(catchError(err => {
  if (err.status !== 401 || /\/auth\/(login|refresh|logout)$/.test(req.url)) return throwError(() => err);
  return auth.refresh().pipe(
   catchError(refreshError => {
    if (refreshError.status === 401) { auth.clearSession(); toast.error('Сессия истекла. Войдите снова.'); }
    return throwError(() => refreshError);
   }),
   switchMap(() => next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } }))),
  );
 }));
};
