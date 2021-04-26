import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ChartsModule } from 'ng2-charts';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SendOrderComponent } from './send-order/send-order.component';
import { OrderListComponent } from './order-list/order-list.component';
import { OrderbookComponent } from './orderbook/orderbook.component';

@NgModule({
  declarations: [
    AppComponent,
    SendOrderComponent,
    OrderListComponent,
    OrderbookComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule,
    ChartsModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
