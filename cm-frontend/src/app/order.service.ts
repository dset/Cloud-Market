import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, merge, Observable, of, Subscription, timer} from 'rxjs';
import {switchMap} from 'rxjs/operators'
import CreateOrderParam from '../../../shared/create-order-param';
import Order from '../../../shared/order';
import {ApiService} from './api.service';
import {UserService} from './user.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService implements OnDestroy {
  private subscriptions = new Subscription()
  private refreshSubject = new BehaviorSubject<object>({})
  private ordersSubject = new BehaviorSubject<Order[]>([])

  constructor(private apiService: ApiService, private userService: UserService) {
    this.subscriptions.add(
      this.userService.observeUser().pipe(
        switchMap((user) => {
          if (user.state !== 'LOGGED_IN') {
            return of([])
          }

          return merge(
            this.refreshSubject,
            timer(2000, 2000)
          )
            .pipe(
              switchMap(() => this.apiService.getUserOrders())
            )
        })
      )
        .subscribe({
          next: (orders) => this.ordersSubject.next(orders),
          error: (err) => console.log(err)
        })
    )
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe()
  }

  createOrder(order: CreateOrderParam): void {
    this.subscriptions.add(
      this.apiService.createOrder(order)
        .subscribe({
          next: () => this.refreshSubject.next({}),
          error: (err) => console.log(err)
        })
    )
  }

  cancelOrder(orderId: string): void {
    this.subscriptions.add(
      this.apiService.deleteOrder(orderId)
        .subscribe({
          next: () => this.refreshSubject.next({}),
          error: (err) => console.log(err)
        })
    )
  }

  observeOrders(): Observable<Order[]> {
    return this.ordersSubject
  }
}
