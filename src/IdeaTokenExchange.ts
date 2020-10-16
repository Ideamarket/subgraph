import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
	TokensBought,
	TokensSold,
} from '../res/generated/IdeaTokenExchange/IdeaTokenExchange'
import { IdeaToken, IdeaMarket, IdeaTokenPricePoint, IdeaTokenMarketCapPoint } from '../res/generated/schema'

export function handleTokensBought(event: TokensBought): void {

	// Update market cap
	const token = IdeaToken.load(event.params.ideaToken.toHex())
	if(!token) {
		throw 'IdeaToken does not exist on TokensBought event'
	}

	token.marketCap = token.marketCap.plus(event.params.rawCost)
	token.save()

	// Make price and market cap point
	const market = IdeaMarket.load(token.market)
	if(!market) {
		throw 'IdeaMarket does not exist on TokensBought event'
	}

	makePricePoint(token as IdeaToken, market as IdeaMarket, event.block.timestamp, event.block.number, event.transaction.index)
	makeMarketCapPoint(token as IdeaToken, event.block.timestamp, event.block.number, event.transaction.index)
}

export function handleTokensSold(event: TokensSold): void {
	const token = IdeaToken.load(event.params.ideaToken.toHex())
	if(!token) {
		throw 'IdeaToken does not exist on TokensSold event'
	}

	token.marketCap = token.marketCap.plus(event.params.rawPrice)
	token.save()

	// Make price and market cap point
	const market = IdeaMarket.load(token.market)
	if(!market) {
		throw 'IdeaMarket does not exist on TokensSold event'
	}

	makePricePoint(token as IdeaToken, market as IdeaMarket, event.block.timestamp, event.block.number, event.transaction.index)
	makeMarketCapPoint(token as IdeaToken, event.block.timestamp, event.block.number, event.transaction.index)
}

function makeMarketCapPoint(token: IdeaToken, timestamp: BigInt, block: BigInt, txindex: BigInt): void {
	const tenPow18 = BigDecimal.fromString('1000000000000000000')
	const marketCapPoint = new IdeaTokenMarketCapPoint(token.id + '-' + block.toHex() + '-' + txindex.toHex())
	marketCapPoint.token = token.id
	marketCapPoint.timestamp = timestamp
	marketCapPoint.block = block
	marketCapPoint.txindex = txindex
	marketCapPoint.marketCap = token.marketCap.toBigDecimal().div(tenPow18)
	marketCapPoint.save()
}

function makePricePoint(token: IdeaToken, market: IdeaMarket, timestamp: BigInt, block: BigInt, txindex: BigInt): void {
	const pricePoint = new IdeaTokenPricePoint(token.id + '-' + block.toHex() + '-' + txindex.toHex())
	pricePoint.token = token.id
	pricePoint.timestamp = timestamp
	pricePoint.block = block
	pricePoint.txindex = txindex
	pricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
	pricePoint.save()
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	const tenPow18 = BigDecimal.fromString('1000000000000000000')
	const completedIntervals = currentSupply.div(market.tokensPerInterval)
	const thisIntervalsPrice = market.baseCost.plus(completedIntervals.times(market.priceRise))

	return thisIntervalsPrice.toBigDecimal().div(tenPow18)
}
