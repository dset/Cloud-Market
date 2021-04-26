import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import CreateOrderParam from '../../../shared/create-order-param'
import Id from '../../../shared/id'
import Order from '../../../shared/order'
import Trade from '../../../shared/trade'
import Orderbook from '../../../shared/orderbook'

const basePath = '/api/v1'
const orderEndpoint = `${basePath}/orders`;
const tradeEndpoint = `${basePath}/trades`;
const orderbookEndpoint = `${basePath}/orderbooks`;

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  createOrder(order: CreateOrderParam): Observable<Id> {
    return this.http.post<Id>(orderEndpoint, order);
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${orderEndpoint}/${id}`)
  }

  deleteOrder(id: string): Observable<any> {
    return this.http.delete<any>(`${orderEndpoint}/${id}`)
  }

  getTrade(id: string): Observable<Trade> {
    return this.http.get<Trade>(`${tradeEndpoint}/${id}`)
  }

  getOrderbook(instrument: string): Observable<Orderbook> {
    return this.http.get<Orderbook>(`${orderbookEndpoint}/${instrument}`)
  }
}
