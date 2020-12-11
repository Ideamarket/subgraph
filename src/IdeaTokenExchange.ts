import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import {
	NewInterestWithdrawer,
	NewPlatformFeeWithdrawer,
	DaiRedeemed,
	TradingFeeRedeemed,
	PlatformFeeRedeemed,
	OwnershipChanged,
	InvestedState,
} from '../res/generated/IdeaTokenExchange/IdeaTokenExchange'
import { IdeaToken, IdeaMarket, IdeaTokenExchange, IdeaTokenVolumePoint } from '../res/generated/schema'

let tenPow18 = BigDecimal.fromString('1000000000000000000')

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

	token.daiInToken = event.params.daiInToken
	token.marketCap = event.params.daiInToken
	token.invested = event.params.daiInvested
	market.platformFeeInvested = event.params.platformFeeInvested
	exchange.tradingFeeInvested = event.params.tradingFeeInvested

	let oldVolumePoint = IdeaTokenVolumePoint.load(
		token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
	)
	if (oldVolumePoint) {
		oldVolumePoint.volume = oldVolumePoint.volume.plus(event.params.volume.toBigDecimal().div(tenPow18))
		oldVolumePoint.save()
	} else {
		let newVolumePoint = new IdeaTokenVolumePoint(
			token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
		)
		newVolumePoint.token = token.id
		newVolumePoint.timestamp = event.block.timestamp
		newVolumePoint.block = event.block.number
		newVolumePoint.txindex = event.transaction.index
		newVolumePoint.volume = event.params.volume.toBigDecimal().div(tenPow18)
		newVolumePoint.save()

		let dayVolumePoints = token.dayVolumePoints
		dayVolumePoints.push(newVolumePoint.id)
		token.dayVolumePoints = dayVolumePoints
	}

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

export function handleDaiRedeemed(event: DaiRedeemed): void {
	let token = IdeaToken.load(event.params.ideaToken.toHex())
	if (!token) {
		throw 'IdeaToken does not exist on DaiRedeemed event'
	}
	token.invested = event.params.investmentToken
	token.save()
}

export function handlePlatformFeeRedeemed(event: PlatformFeeRedeemed): void {
	let market = IdeaMarket.load(event.params.marketID.toHex())
	if (!market) {
		throw 'Market does not exist on PlatformFeeRedeemed event'
	}
	market.platformFeeInvested = BigInt.fromI32(0)
	market.save()
}

export function handleTradingFeeRedeemed(event: TradingFeeRedeemed): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	if (!exchange) {
		throw 'IdeaTokenExchange does not exist on TradingFeeRedeemed event'
	}

	exchange.tradingFeeInvested = BigInt.fromI32(0)
	exchange.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let exchange = IdeaTokenExchange.load(event.address.toHex())
	if (!exchange) {
		exchange = new IdeaTokenExchange(event.address.toHex())
	}

	exchange.owner = event.params.newOwner
	exchange.tradingFeeInvested = BigInt.fromI32(0)
	exchange.save()
}
