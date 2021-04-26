import { Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import Side from '../../../../shared/side';
import { OrderService} from '../order.service'

@Component({
  selector: 'app-send-order',
  templateUrl: './send-order.component.html',
  styleUrls: ['./send-order.component.css']
})
export class SendOrderComponent {
  @Input() instrument!: FormControl

  orderForm = new FormGroup({
    side: new FormControl(Side.BUY, [Validators.required]),
    volume: new FormControl(null, [Validators.required, Validators.min(1)]),
    price: new FormControl(null, [Validators.required, Validators.min(0)]),
  })

  constructor(private orderService: OrderService) { }

  onSend(): void {
    if (this.orderForm.valid && this.instrument.value) {
      this.orderService.createOrder({
        instrument: this.instrument.value,
        side: this.orderForm.value.side,
        volume: this.orderForm.value.volume,
        price: this.orderForm.value.price
      })
    }
  }
}
