import { Injectable } from '@angular/core';
import {Observable} from 'rxjs';
import Orderbook from '../../../shared/orderbook';
import {ApiService} from './api.service';

@Injectable({
  providedIn: 'root'
})
export class OrderbookService {

  constructor(private apiService: ApiService) { }

  getOrderbook(instrument: string): Observable<Orderbook> {
    return this.apiService.getOrderbook(instrument)
  }
}
