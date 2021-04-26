import { TestBed } from '@angular/core/testing';

import { OrderbookService } from './orderbook.service';

describe('OrderbookService', () => {
  let service: OrderbookService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderbookService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
