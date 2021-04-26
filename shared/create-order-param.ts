import Side from './side'

export default interface CreateOrderParam {
  instrument: string,
  side: Side,
  volume: number,
  price: number
}