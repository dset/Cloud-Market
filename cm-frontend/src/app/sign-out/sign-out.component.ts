import {Component} from '@angular/core';
import {User} from 'firebase/auth';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {UserService} from '../user.service';

@Component({
  selector: 'app-sign-out',
  templateUrl: './sign-out.component.html',
  styleUrls: ['./sign-out.component.css']
})
export class SignOutComponent {
  public user: Observable<User | null> = this.userService.observeUser().pipe(
    map((u) => u.state == 'LOGGED_IN' ? u.user : null)
  )

  constructor(private userService: UserService) { }

  signOut(): void {
    this.userService.signOut()
  }
}
