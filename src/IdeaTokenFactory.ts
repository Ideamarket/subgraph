import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	OwnershipChanged
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import { IdeaMarket, IdeaToken, IdeaTokenFactory, IdeaTokenMarketCapPoint, IdeaTokenPricePoint } from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')
const tenPow18 = BigDecimal.fromString('1000000000000000000')

export function handleNewMarket(event: NewMarket): void {
	const market = new IdeaMarket(event.params.id.toHex())

	market.marketID = event.params.id.toI32()
	market.name = event.params.name
	market.baseCost = event.params.baseCost
	market.priceRise = event.params.priceRise
	market.tradingFeeRate = event.params.tradingFeeRate
	market.platformFeeRate = event.params.platformFeeRate
	market.platformFeeWithdrawer = zeroAddress
	market.platformFeeInvested = BigInt.fromI32(0)
	market.save()
}

export function handleNewToken(event: NewToken): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	if(!market) {
		throw 'IdeaMarket does not exist on NewToken event'
	}

	const tokenID = event.params.addr.toHex()

	// Initial price and market cap points
	const marketCapPoint = new IdeaTokenMarketCapPoint(tokenID + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex())
	marketCapPoint.token = tokenID
	marketCapPoint.timestamp = event.block.timestamp
	marketCapPoint.block = event.block.number
	marketCapPoint.txindex = event.transaction.index
	marketCapPoint.marketCap = BigDecimal.fromString('0')
	marketCapPoint.save()

	const pricePointID = tokenID + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
	const pricePoint = new IdeaTokenPricePoint(pricePointID)
	pricePoint.token = tokenID
	pricePoint.timestamp = event.block.timestamp
	pricePoint.block = event.block.number
	pricePoint.txindex = event.transaction.index
	pricePoint.oldPrice = market.baseCost.toBigDecimal().div(tenPow18) 
	pricePoint.price = market.baseCost.toBigDecimal().div(tenPow18)
	pricePoint.save()

	const token = new IdeaToken(tokenID)
	token.tokenID = event.params.id.toI32()
	token.market = market.id
	token.name = event.params.name
	token.supply = BigInt.fromI32(0)
	token.holders = 0
	token.marketCap = BigInt.fromI32(0)
	token.owner = zeroAddress
	token.interestWithdrawer = zeroAddress
	token.daiInToken = BigInt.fromI32(0)
	token.invested = BigInt.fromI32(0)
	token.dayChange = BigDecimal.fromString('0')
	token.latestPricePoint = pricePointID
	token.dayPricePoints = [pricePointID]
	token.save()

	const factory = IdeaTokenFactory.load('factory')
	if(!factory) {
		throw 'IdeaTokenFactory does not exist on NewToken event'
	}
	const allTokens = factory.allTokens
	allTokens.push(tokenID)
	factory.allTokens = allTokens
	factory.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let factory = IdeaTokenFactory.load('factory')
	if(!factory) {
		factory = new IdeaTokenFactory('factory')
		factory.allTokens = []
	}

	factory.owner = event.params.newOwner
	factory.save()
}
