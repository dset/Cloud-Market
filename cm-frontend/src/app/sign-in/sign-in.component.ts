import {Component} from '@angular/core';
import {UserService} from '../user.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css']
})
export class SignInComponent {

  constructor(private userService: UserService) { }

  signIn(): void {
    this.userService.signIn()
  }
}
