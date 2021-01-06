import { BigDecimal, ethereum } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	NewNameVerifier,
	OwnershipChanged,
	NewPlatformFee,
	NewTradingFee,
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import { IdeaMarket, IdeaToken, IdeaTokenFactory, IdeaTokenPricePoint } from '../res/generated/schema'

import { blockHandler } from './BlockHandler'
import { TEN_POW_18, ZERO_ADDRESS, ZERO, bigIntToBigDecimal, addFutureDayValueChange } from './shared'

export function handleBlock(block: ethereum.Block): void {
	blockHandler(block)
}

export function handleNewMarket(event: NewMarket): void {
	let market = new IdeaMarket(event.params.id.toHex())

	market.marketID = event.params.id.toI32()
	market.name = event.params.name
	market.baseCost = event.params.baseCost
	market.priceRise = event.params.priceRise
	market.hatchTokens = event.params.hatchTokens
	market.tradingFeeRate = event.params.tradingFeeRate
	market.platformFeeRate = event.params.platformFeeRate
	market.platformOwner = ZERO_ADDRESS
	market.platformFeeInvested = ZERO
	market.allInterestToPlatform = event.params.allInterestToPlatform
	market.nameVerifier = event.params.nameVerifier
	market.daiInMarket = ZERO
	market.invested = ZERO
	market.platformFeeRedeemed = ZERO
	market.platformInterestRedeemed = ZERO
	market.save()
}

export function handleNewToken(event: NewToken): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on NewToken event'
	}

	let tokenID = event.params.addr.toHex()

	let pricePointID = event.transaction.hash.toHex() + '-' + event.logIndex.toHex()
	let pricePoint = new IdeaTokenPricePoint(pricePointID)
	pricePoint.token = tokenID
	pricePoint.timestamp = event.block.timestamp
	pricePoint.oldPrice = bigIntToBigDecimal(market.baseCost, TEN_POW_18)
	pricePoint.price = bigIntToBigDecimal(market.baseCost, TEN_POW_18)
	pricePoint.save()

	let token = new IdeaToken(tokenID)
	token.tokenID = event.params.id.toI32()
	token.market = market.id
	token.name = event.params.name
	token.supply = ZERO
	token.holders = 0
	token.marketCap = ZERO
	token.tokenOwner = ZERO_ADDRESS
	token.daiInToken = ZERO
	token.invested = ZERO
	token.tokenInterestRedeemed = ZERO
	token.dayChange = BigDecimal.fromString('0')
	token.dayVolume = BigDecimal.fromString('0')
	token.listedAt = event.block.timestamp
	token.lockedAmount = ZERO
	token.lockedPercentage = BigDecimal.fromString('0.0')
	token.lister = event.params.lister
	token.latestPricePoint = pricePointID
	token.dayPricePoints = [pricePointID]
	token.dayVolumePoints = []
	token.save()

	addFutureDayValueChange(token as IdeaToken, event.block.timestamp)
}

export function handleNewNameVerifier(event: NewNameVerifier): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
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
	}

	factory.owner = event.params.newOwner
	factory.save()
}

export function handleNewTradingFee(event: NewTradingFee): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on NewTradingFee event'
	}

	market.tradingFeeRate = event.params.tradingFeeRate
	market.save()
}

export function handleNewPlatformFee(event: NewPlatformFee): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on NewPlatformFee event'
	}

	market.platformFeeRate = event.params.platformFeeRate
	market.save()
}
