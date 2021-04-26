import Side from './side'
import Depth from './depth'

export default interface Orderbook {
    [Side.BUY]: Depth[],
    [Side.SELL]: Depth[]
}