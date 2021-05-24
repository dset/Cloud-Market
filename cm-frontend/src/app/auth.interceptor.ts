import {Injectable} from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import {from, Observable} from 'rxjs';
import {getAuth} from "firebase/auth"
import {first, switchMap} from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const user = getAuth().currentUser
    if (user === null) {
      return next.handle(request)
    } else {
      return from(user.getIdToken()).pipe(
        first(),
        switchMap((token) => {
          return next.handle(request.clone({setHeaders: {Authorization: `Bearer ${token}`}}))
        })
      )
    }
  }
}
