import { Component } from '@angular/core';
import {map} from 'rxjs/operators';
import {OrderService} from '../order.service';

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.css']
})
export class OrderListComponent {
  orders = this.orderService.observeOrders().pipe(
    map((map) => [...map.values()]),
    map((orders) => orders.sort((a, b) => a.create_time - b.create_time))
  )

  constructor(private orderService: OrderService) { }

  onCancel(orderId: string): void {
    this.orderService.cancelOrder(orderId)
  }
}
