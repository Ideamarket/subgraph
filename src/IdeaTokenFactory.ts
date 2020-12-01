import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	NewNameVerifier,
	OwnershipChanged,
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import {
	IdeaMarket,
	IdeaToken,
	IdeaTokenFactory,
	IdeaTokenPricePoint,
	IdeaTokenVolumePoint,
} from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')
const tenPow18 = BigDecimal.fromString('1000000000000000000')

/*
	// https://thegraph.com/docs/assemblyscript-api#api-reference

	// This won't work
	entity.numbers.push(BigInt.fromI32(1))
	entity.save()

	// This will work
	let numbers = entity.numbers
	numbers.push(BigInt.fromI32(1))
	entity.numbers = numbers
	entity.save()
*/

export function handleNewMarket(event: NewMarket): void {
	const market = new IdeaMarket(event.params.id.toHex())

	market.marketID = event.params.id.toI32()
	market.name = event.params.name
	market.baseCost = event.params.baseCost
	market.priceRise = event.params.priceRise
	market.hatchTokens = event.params.hatchTokens
	market.tradingFeeRate = event.params.tradingFeeRate
	market.platformFeeRate = event.params.platformFeeRate
	market.platformFeeWithdrawer = zeroAddress
	market.platformFeeInvested = BigInt.fromI32(0)
	market.nameVerifier = event.params.nameVerifier
	market.save()
}

export function handleNewToken(event: NewToken): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on NewToken event'
	}

	const tokenID = event.params.addr.toHex()

	const pricePointID = tokenID + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
	const pricePoint = new IdeaTokenPricePoint(pricePointID)
	pricePoint.token = tokenID
	pricePoint.timestamp = event.block.timestamp
	pricePoint.block = event.block.number
	pricePoint.txindex = event.transaction.index
	pricePoint.oldPrice = market.baseCost.toBigDecimal().div(tenPow18)
	pricePoint.price = market.baseCost.toBigDecimal().div(tenPow18)
	pricePoint.save()

	const volumePointID = tokenID + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
	const volumePoint = new IdeaTokenVolumePoint(volumePointID)
	volumePoint.token = tokenID
	volumePoint.timestamp = event.block.timestamp
	volumePoint.block = event.block.number
	volumePoint.txindex = event.transaction.index
	volumePoint.oldVolume = BigDecimal.fromString('0')
	volumePoint.volume = BigDecimal.fromString('0')
	volumePoint.save()

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
	token.listedAt = event.block.timestamp
	token.pricePoints = [pricePointID]
	token.volumePoints = [volumePointID]
	token.save()

	const factory = IdeaTokenFactory.load('factory')
	if (!factory) {
		throw 'IdeaTokenFactory does not exist on NewToken event'
	}
	const allTokens = factory.allTokens
	allTokens.push(tokenID)
	factory.allTokens = allTokens
	factory.save()
}

export function handleNewNameVerifier(event: NewNameVerifier): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on NewNameVerifier event'
	}

	market.nameVerifier = event.params.nameVerifier
	market.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let factory = IdeaTokenFactory.load('factory')
	if (!factory) {
		factory = new IdeaTokenFactory('factory')
		factory.allTokens = []
	}

	factory.owner = event.params.newOwner
	factory.save()
}
