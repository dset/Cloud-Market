import {Component} from '@angular/core'
import {FormControl} from '@angular/forms'
import {Observable} from 'rxjs'
import {UserResult, UserService} from './user.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  public instrument = new FormControl('')
  public user: Observable<UserResult> = this.userService.observeUser()

  constructor(private userService: UserService) {}
}
