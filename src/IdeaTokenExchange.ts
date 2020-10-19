import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
	TokensBought,
	TokensSold,
	NewInterestWithdrawer,
	NewPlatformFeeWithdrawer,
	DaiInvested,
	TradingFeeInvested,
	PlatformFeeInvested,
	OwnershipChanged
} from '../res/generated/IdeaTokenExchange/IdeaTokenExchange'
import { IdeaToken, IdeaMarket, IdeaTokenPricePoint, IdeaTokenMarketCapPoint, IdeaTokenExchange } from '../res/generated/schema'

const tenPow18 = BigDecimal.fromString('1000000000000000000')

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

	makePricePoint(token as IdeaToken, market as IdeaMarket, event.params.finalCost, event.block.timestamp, event.block.number, event.transaction.index)
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

	makePricePoint(token as IdeaToken, market as IdeaMarket, event.params.rawPrice, event.block.timestamp, event.block.number, event.transaction.index)
	makeMarketCapPoint(token as IdeaToken, event.block.timestamp, event.block.number, event.transaction.index)
}

export function handleNewInterestWithdrawer(event: NewInterestWithdrawer): void {
	const token = IdeaToken.load(event.params.ideaToken.toHex())
	token.interestWithdrawer = event.params.withdrawer
	token.save()
}

export function handleNewPlatformFeeWithdrawer(event: NewPlatformFeeWithdrawer): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	market.platformFeeWithdrawer = event.params.withdrawer
	market.save()
}

export function handleDaiInvested(event: DaiInvested): void {
	const token = IdeaToken.load(event.params.ideaToken.toHex())
	token.daiInToken = event.params.daiInToken
	token.invested = event.params.investmentToken
	token.save()
}

export function handlePlatformFeeInvested(event: PlatformFeeInvested): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	market.platformFeeInvested = event.params.investmentToken
	market.save()
}

export function handleTradingFeeInvested(event: TradingFeeInvested): void {
	const exchange = IdeaTokenExchange.load(event.address.toHex())
	if(!exchange) {
		throw 'IdeaTokenExchange does not exist on TradingFeeInvested event'
	}

	exchange.tradingFeeInvested = event.params.investmentToken
	exchange.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	if(!exchange) {
		exchange = new IdeaTokenExchange(event.address.toHex())
	}

	exchange.owner = event.params.newOwner
	exchange.tradingFeeInvested = BigInt.fromI32(0)
	exchange.save()
}

function makeMarketCapPoint(token: IdeaToken, timestamp: BigInt, block: BigInt, txindex: BigInt): void {
	const marketCapPoint = new IdeaTokenMarketCapPoint(token.id + '-' + block.toHex() + '-' + txindex.toHex())
	marketCapPoint.token = token.id
	marketCapPoint.timestamp = timestamp
	marketCapPoint.block = block
	marketCapPoint.txindex = txindex
	marketCapPoint.marketCap = token.marketCap.toBigDecimal().div(tenPow18)
	marketCapPoint.save()
}

function makePricePoint(token: IdeaToken, market: IdeaMarket, volume: BigInt, timestamp: BigInt, block: BigInt, txindex: BigInt): void {
	const pricePoint = new IdeaTokenPricePoint(token.id + '-' + block.toHex() + '-' + txindex.toHex())
	pricePoint.token = token.id
	pricePoint.timestamp = timestamp
	pricePoint.block = block
	pricePoint.txindex = txindex
	pricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
	pricePoint.volume = volume.toBigDecimal().div(tenPow18)
	pricePoint.save()
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	return market.baseCost.plus(currentSupply.times(market.priceRise)).toBigDecimal().div(tenPow18)
}
