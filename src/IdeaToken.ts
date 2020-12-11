import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { Transfer, Approval, OwnershipChanged } from '../res/generated/IdeaToken/IdeaToken'
import {
	IdeaToken,
	IdeaTokenBalance,
	IdeaTokenAllowance,
	IdeaMarket,
	IdeaTokenPricePoint,
} from '../res/generated/schema'

import { updateLockedPercentage } from './IdeaTokenVault'

import { ZERO_ADDRESS, TEN_POW_18, bigIntToBigDecimal } from './shared'

export function handleTransfer(event: Transfer): void {
	let token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}
	let market = IdeaMarket.load(token.market)
	if (!market) {
		throw 'Market does not exist on Transfer event'
	}

	if (event.params.from.equals(ZERO_ADDRESS)) {
		// Transfer from the zero address is mint. Increase supply
		token.supply = token.supply.plus(event.params.value)
		updateLockedPercentage(token as IdeaToken)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
	} else {
		// Transfer not from zero address. Decrease balance
		let fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
		if (!fromBalance) {
			throw 'FromBalance is not defined on Transfer event'
		}
		fromBalance.amount = fromBalance.amount.minus(event.params.value)
		fromBalance.save()

		// If the balance is decreased to zero remove one holder
		if (fromBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders - 1
		}
	}

	if (event.params.to.equals(ZERO_ADDRESS)) {
		// Transfer to the zero address is burn. Decrease supply
		token.supply = token.supply.minus(event.params.value)
		updateLockedPercentage(token as IdeaToken)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
	} else {
		// Transfer not to zero address. Increase balance
		let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
		if (!toBalance) {
			toBalance = new IdeaTokenBalance(event.params.to.toHex() + '-' + token.id)
			toBalance.holder = event.params.to
			toBalance.amount = BigInt.fromI32(0)
			toBalance.token = token.id
			toBalance.market = market.id
		}
		let beforeBalance = toBalance.amount
		toBalance.amount = toBalance.amount.plus(event.params.value)
		toBalance.save()

		// If the balance is was zero before and now is greater than zero add one holder
		if (beforeBalance.equals(BigInt.fromI32(0)) && !toBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders + 1
		}
	}

	token.save()
}

export function handleApproval(event: Approval): void {
	let token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}

	let allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
	let allowance = IdeaTokenAllowance.load(allowanceID)
	if (!allowance) {
		allowance = new IdeaTokenAllowance(allowanceID)
		allowance.token = token.id
		allowance.amount = BigInt.fromI32(0)
	}

	allowance.amount = allowance.amount.plus(event.params.value)
	allowance.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}

	token.owner = event.params.newOwner
	token.save()
}

function addPricePoint(token: IdeaToken, market: IdeaMarket, event: Transfer): void {
	let oldPricePoint = IdeaTokenPricePoint.load(token.latestPricePoint)

	if (oldPricePoint.block === event.block.number && oldPricePoint.txindex === event.transaction.index) {
		oldPricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
		oldPricePoint.save()
	} else {
		let newPricePoint = new IdeaTokenPricePoint(
			token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
		)
		newPricePoint.token = token.id
		newPricePoint.timestamp = event.block.timestamp
		newPricePoint.block = event.block.number
		newPricePoint.txindex = event.transaction.index
		newPricePoint.oldPrice = oldPricePoint.price
		newPricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
		newPricePoint.save()

		token.latestPricePoint = newPricePoint.id
		let dayPricePoints = token.dayPricePoints
		dayPricePoints.push(newPricePoint.id)
		token.dayPricePoints = dayPricePoints
	}
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	if (currentSupply.lt(market.hatchTokens)) {
		return bigIntToBigDecimal(market.baseCost, TEN_POW_18)
	}

	let updatedSupply = currentSupply.minus(market.hatchTokens)

	return bigIntToBigDecimal(
		market.baseCost.plus(updatedSupply.times(market.priceRise).div(BigInt.fromI32(10).pow(18))),
		TEN_POW_18
	)
}
