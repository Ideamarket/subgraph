import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	OwnershipChanged
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import { IdeaMarket, IdeaToken, IdeaTokenFactory, IdeaTokenMarketCapPoint, IdeaTokenPricePoint } from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')

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

	const token = new IdeaToken(event.params.addr.toHex())
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
	token.save()
  
	// Initial price and market cap points
	const marketCapPoint = new IdeaTokenMarketCapPoint(token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex())
	marketCapPoint.token = token.id
	marketCapPoint.timestamp = event.block.timestamp
	marketCapPoint.block = event.block.number
	marketCapPoint.txindex = event.transaction.index
	marketCapPoint.marketCap = BigDecimal.fromString('0')
	marketCapPoint.save()

	const pricePoint = new IdeaTokenPricePoint(token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex())
	const tenPow18 = BigDecimal.fromString('1000000000000000000')
	pricePoint.token = token.id
	pricePoint.timestamp = event.block.timestamp
	pricePoint.block = event.block.number
	pricePoint.txindex = event.transaction.index
	pricePoint.price = market.baseCost.toBigDecimal().div(tenPow18)
	pricePoint.volume = BigDecimal.fromString('0')
	pricePoint.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let factory = IdeaTokenFactory.load(event.address.toHex())
	if(!factory) {
		factory = new IdeaTokenFactory(event.address.toHex())
	}

	factory.owner = event.params.newOwner

	factory.save()
}
