import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import {
	NewInterestWithdrawer,
	NewPlatformFeeWithdrawer,
	TradingFeeRedeemed,
	PlatformFeeRedeemed,
	OwnershipChanged,
	InvestedState,
	TokenInterestRedeemed,
	PlatformInterestRedeemed,
} from '../res/generated/IdeaTokenExchange/IdeaTokenExchange'
import { IdeaToken, IdeaMarket, IdeaTokenExchange, IdeaTokenVolumePoint } from '../res/generated/schema'

import { TEN_POW_18, ZERO, bigIntToBigDecimal, addFutureDayValueChange, appendToArray } from './shared'

export function handleInvestedState(event: InvestedState): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	let market = IdeaMarket.load(event.params.marketID.toHex())
	let token = IdeaToken.load(event.params.ideaToken.toHex())

	if (!exchange) {
		throw 'IdeaTokenExchange does not exist on InvestedState event'
	}
	if (!market) {
		throw 'Market does not exist on InvestedState event'
	}
	if (!token) {
		throw 'IdeaToken does not exist on InvestedState event'
	}

	if (market.allInterestToPlatform) {
		if (market.daiInMarket.lt(event.params.dai)) {
			// Event was a buy
			token.marketCap = token.marketCap.plus(event.params.dai.minus(market.daiInMarket))
		} else {
			// Event was a sell
			token.marketCap = token.marketCap.minus(market.daiInMarket.minus(event.params.dai))
		}

		market.daiInMarket = event.params.dai
		market.invested = event.params.daiInvested
	} else {
		token.daiInToken = event.params.dai
		token.marketCap = event.params.dai
		token.invested = event.params.daiInvested
	}

	market.platformFeeInvested = event.params.platformFeeInvested
	exchange.tradingFeeInvested = event.params.tradingFeeInvested

	let newVolumePoint = new IdeaTokenVolumePoint(
		event.transaction.hash.toHex() + '-' + event.logIndex.toHex()
	)
	newVolumePoint.token = token.id
	newVolumePoint.timestamp = event.block.timestamp
	newVolumePoint.volume = bigIntToBigDecimal(event.params.volume, TEN_POW_18)
	newVolumePoint.save()

	token.dayVolumePoints = appendToArray(token.dayVolumePoints, newVolumePoint.id)
	addFutureDayValueChange(token as IdeaToken, event.block.timestamp)

	updateTokenDayVolume(token as IdeaToken)

	token.save()
	market.save()
	exchange.save()
}

export function handleNewInterestWithdrawer(event: NewInterestWithdrawer): void {
	let token = IdeaToken.load(event.params.ideaToken.toHex())
	if (!token) {
		throw 'IdeaToken does not exist on NewInterestWithdrawer event'
	}
	token.interestWithdrawer = event.params.withdrawer
	token.save()
}

export function handleNewPlatformFeeWithdrawer(event: NewPlatformFeeWithdrawer): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'Market does not exist on handleNewPlatformFeeWithdrawer event'
	}
	market.platformFeeWithdrawer = event.params.withdrawer
	market.save()
}

export function handleTokenInterestRedeemed(event: TokenInterestRedeemed): void {
	let token = IdeaToken.load(event.params.ideaToken.toHex())
	if (!token) {
		throw 'IdeaToken does not exist on TokenInterestRedeemed event'
	}
	token.invested = event.params.investmentToken
	token.tokenInterestRedeemed = event.params.daiRedeemed
	token.save()
}

export function handlePlatformInterestRedeemed(event: PlatformInterestRedeemed): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'IdeaMarket does not exist on PlatformInterestRedeemed event'
	}
	market.invested = event.params.investmentToken
	market.platformInterestRedeemed = event.params.daiRedeemed
	market.save()
}

export function handlePlatformFeeRedeemed(event: PlatformFeeRedeemed): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'Market does not exist on PlatformFeeRedeemed event'
	}
	market.platformFeeInvested = ZERO
	market.platformFeeRedeemed = event.params.daiRedeemed
	market.save()
}

export function handleTradingFeeRedeemed(event: TradingFeeRedeemed): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	if (!exchange) {
		throw 'IdeaTokenExchange does not exist on TradingFeeRedeemed event'
	}

	exchange.tradingFeeInvested = ZERO
	exchange.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	// This event is emitted by the ctor
	if (!exchange) {
		exchange = new IdeaTokenExchange(event.address.toHex())
	}

	exchange.owner = event.params.newOwner
	exchange.tradingFeeInvested = ZERO
	exchange.save()
}

export function updateTokenDayVolume(token: IdeaToken): void {
	let dayVolumePoints = token.dayVolumePoints
	let dayVolume = BigDecimal.fromString('0')
	for (let c = 0; c < dayVolumePoints.length; c++) {
		let volumePoint = IdeaTokenVolumePoint.load(dayVolumePoints[c])
		dayVolume = dayVolume.plus(volumePoint.volume)
	}
	token.dayVolume = dayVolume
}
