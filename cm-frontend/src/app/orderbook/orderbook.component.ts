import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {FormControl} from '@angular/forms';
import * as Chart from 'chart.js';
import {ChartDataSets, ChartOptions} from 'chart.js';
import {of, Subscription} from 'rxjs';
import {catchError, delay, repeatWhen, startWith, switchMap} from 'rxjs/operators';
import Orderbook from '../../../../shared/orderbook';
import Side from '../../../../shared/side';
import {OrderbookService} from '../orderbook.service';

@Component({
  selector: 'app-orderbook',
  templateUrl: './orderbook.component.html',
  styleUrls: ['./orderbook.component.css']
})
export class OrderbookComponent implements OnInit, OnDestroy {
  public lineChartData: ChartDataSets[] = [
    {data: [], label: Side.BUY, steppedLine: true},
    {data: [], label: Side.SELL, steppedLine: true},
  ]
  public lineChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: [{
        type: 'linear',
        ticks: {
          fontColor: '#DFDFDF'
        }
      }],
      yAxes: [{
        ticks: {
          beginAtZero: true,
          fontColor: '#DFDFDF',
          maxTicksLimit: 6
        }
      }]
    },
    animation: {
      duration: 0
    },
    legend: {
      position: 'bottom',
      align: 'end',
      labels: {
        fontColor: '#DFDFDF'
      }
    }
  }

  @Input() public instrument!: FormControl
  private subscription = new Subscription()

  constructor(private orderbookService: OrderbookService) { }

  ngOnInit(): void {
    const emptyOrderbook: Orderbook = {[Side.BUY]: [], [Side.SELL]: []}

    this.subscription.add(
      this.instrument.valueChanges.pipe(
        switchMap((val) => {
          return this.orderbookService.getOrderbook(val).pipe(
            catchError((_) => of(emptyOrderbook)),
            repeatWhen((n) => n.pipe(delay(2000))),
            startWith(emptyOrderbook)
          )
        })
      )
        .subscribe({
          next: (orderbook) => {
            let cumBuy = 0;
            this.lineChartData[0].data = orderbook.BUY.map((depth) => {cumBuy += depth.volume; return {x: depth.price, y: cumBuy}})
            let cumSell = 0;
            this.lineChartData[1].data = orderbook.SELL.map((depth) => {cumSell += depth.volume; return {x: depth.price, y: cumSell}})
          },
          error: (error) => console.log(error)
        })
    )
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe()
  }
}
