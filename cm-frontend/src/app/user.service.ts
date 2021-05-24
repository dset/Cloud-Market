import {Injectable} from '@angular/core'
import {getAuth, User, GoogleAuthProvider, signOut, signInWithRedirect} from "firebase/auth"
import {BehaviorSubject, Observable} from 'rxjs'
import {initializeApp} from 'firebase/app'

export type UserResult = UserUnknownState | UserLoggedOutState | UserLoggedInState

type UserUnknownState = {
  state: "UNKNOWN"
}

type UserLoggedOutState = {
  state: "LOGGED_OUT"
}

type UserLoggedInState = {
  state: "LOGGED_IN",
  user: User
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<UserResult>({state: 'UNKNOWN'})

  constructor() {
    initializeApp({
      apiKey: "AIzaSyBKXaj8-EsH-R9P6ITpJnIIsMgzY4am3to",
      authDomain: "cloud-market-917a7.firebaseapp.com",
      projectId: "cloud-market-917a7",
      storageBucket: "cloud-market-917a7.appspot.com",
      messagingSenderId: "509229297718",
      appId: "1:509229297718:web:bed97a2c3190070fe46897"
    })

    getAuth().onAuthStateChanged((user) => {
      this.userSubject.next(user === null ? {state: 'LOGGED_OUT'} : {state: 'LOGGED_IN', user: user})
    })
  }

  observeUser(): Observable<UserResult> {
    return this.userSubject
  }

  signIn(): void {
    signInWithRedirect(getAuth(), new GoogleAuthProvider())
      .then(() => {
        // We will get a user in onAuthStateChanged
      })
      .catch((err) => {
        console.log(err);
      })
  }

  signOut(): void {
    signOut(getAuth())
      .then(() => {
        // We will get called in onAuthStateChanged
      })
      .catch((err) => {
        console.log(err);
      })
  }
}
