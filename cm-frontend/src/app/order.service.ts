import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {switchMap, repeatWhen, delay, takeWhile, map} from 'rxjs/operators'
import CreateOrderParam from '../../../shared/create-order-param';
import Order from '../../../shared/order';
import {ApiService} from './api.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService implements OnDestroy {
  private subscriptions = new Subscription()
  private ordersSubject = new BehaviorSubject<Map<string, Order>>(new Map())

  constructor(private apiService: ApiService) { }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe()
  }

  createOrder(order: CreateOrderParam): void {
    this.subscriptions.add(
      this.apiService.createOrder(order).pipe(
        switchMap((id) => {
          return this.apiService.getOrder(id.id).pipe(
            repeatWhen((n) => n.pipe(delay(2000))),
            takeWhile((order) => order.active_volume > 0, true)
          )
        })
      )
        .subscribe({
          next: (order) => {
            this.ordersSubject.next(this.ordersSubject.value.set(order.id, order))
          },
          error: (err) => { console.log(err) }
        })
    )
  }

  cancelOrder(orderId: string): void {
    this.subscriptions.add(
      this.apiService.deleteOrder(orderId).subscribe({
        error: (err) => console.log(err)
      })
    )
  }

  observeOrders(): Observable<Map<string, Order>> {
    return this.ordersSubject
  }
}
