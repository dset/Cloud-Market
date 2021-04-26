import Side from './side'

export default interface Depth {
    instrument: string,
    side: Side,
    volume: number,
    price: number
}