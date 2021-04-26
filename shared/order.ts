import Side from './side'

export default interface Order {
    id: string,
    instrument: string,
    side: Side,
    total_volume: number,
    active_volume: number,
    filled_volume: number,
    price: number,
    related_trades: string[],
    create_time: number
}