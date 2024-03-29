import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { Transfer, Approval } from '../res/generated/templates/IdeaToken/IdeaToken'
import {
	IdeaToken,
	IdeaTokenBalance,
	IdeaTokenAllowance,
	IdeaMarket,
	IdeaTokenPricePoint,
	IdeaTokenTrade,
} from '../res/generated/schema'

import { updateLockedPercentage } from './IdeaTokenVault'

import {
	ZERO_ADDRESS,
	ZERO,
	TEN_POW_18,
	TEN_POW_18_BIG_INT,
	bigIntToBigDecimal,
	appendToArray,
	addFutureDayValueChange,
	first,
	last,
} from './shared'

let FEE_SCALE = BigInt.fromI32(10000)

export function handleTransfer(event: Transfer): void {
	let token = IdeaToken.load(event.address.toHex())
	if (!token) {
		throw 'Token does not exist on Transfer event'
	}

	let market = IdeaMarket.load(token.market)
	if (!market) {
		throw 'Market does not exist on Transfer event'
	}

	if (event.params.from.equals(ZERO_ADDRESS)) {
		// Transfer from the zero address is mint. Increase supply
		handleTrade(token!, market!, event.params.value, true, event)
		token.supply = token.supply.plus(event.params.value)
		updateLockedPercentage(token as IdeaToken)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
		updateTokenDayPriceChange(token as IdeaToken)
	} else {
		// Transfer not from zero address. Decrease balance
		let fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
		if (!fromBalance) {
			throw 'FromBalance is not defined on Transfer event'
		}
		fromBalance.amount = fromBalance.amount.minus(event.params.value)
		fromBalance.save()

		// If the balance is decreased to zero remove one holder
		if (fromBalance.amount.equals(ZERO)) {
			token.holders = token.holders - 1
		}
	}

	if (event.params.to.equals(ZERO_ADDRESS)) {
		// Transfer to the zero address is burn. Decrease supply
		handleTrade(token!, market!, event.params.value, false, event)
		token.supply = token.supply.minus(event.params.value)
		updateLockedPercentage(token as IdeaToken)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
		updateTokenDayPriceChange(token as IdeaToken)
	} else {
		// Transfer not to zero address. Increase balance
		let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
		if (!toBalance) {
			// This address received IdeaTokens for the first time
			toBalance = new IdeaTokenBalance(event.params.to.toHex() + '-' + token.id)
			toBalance.holder = event.params.to
			toBalance.amount = ZERO
			toBalance.token = token.id
			toBalance.market = market.id
		}
		let beforeBalance = toBalance.amount
		toBalance.amount = toBalance.amount.plus(event.params.value)
		toBalance.save()

		// If the balance is was zero before and now is greater than zero add one holder
		if (beforeBalance.equals(ZERO) && !toBalance.amount.equals(ZERO)) {
			token.holders = token.holders + 1
		}
	}

	token.save()
}

export function handleApproval(event: Approval): void {
	let token = IdeaToken.load(event.address.toHex())
	if (!token) {
		throw 'Token does not exist on Approval event'
	}

	let allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
	let allowance = IdeaTokenAllowance.load(allowanceID)
	if (!allowance) {
		// This pair of owner <-> spender address has no previous allowance
		allowance = new IdeaTokenAllowance(allowanceID)
		allowance.token = token.id
		allowance.amount = ZERO
	}

	allowance.amount = allowance.amount.plus(event.params.value)
	allowance.save()
}

function handleTrade(
	token: IdeaToken,
	market: IdeaMarket,
	ideaTokenAmount: BigInt,
	isBuy: boolean,
	event: Transfer
): void {
	let trade = new IdeaTokenTrade(event.transaction.hash.toHex() + '-' + event.logIndex.toHex())
	trade.token = token.id
	trade.owner = event.transaction.from
	trade.isBuy = isBuy
	trade.timestamp = event.block.timestamp
	trade.ideaTokenAmount = ideaTokenAmount
	trade.daiAmount = isBuy
		? getTotalBuyPrice(market, ideaTokenAmount, token.supply)
		: getTotalSellPrice(market, ideaTokenAmount, token.supply)
	trade.save()
}

function addPricePoint(token: IdeaToken, market: IdeaMarket, event: Transfer): void {
	let oldPricePoint = IdeaTokenPricePoint.load(token.latestPricePoint)

	let newPricePoint = new IdeaTokenPricePoint(event.transaction.hash.toHex() + '-' + event.logIndex.toHex())
	newPricePoint.token = token.id
	newPricePoint.counter = oldPricePoint.counter + 1
	newPricePoint.timestamp = event.block.timestamp
	newPricePoint.oldPrice = oldPricePoint.price
	newPricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
	newPricePoint.save()

	token.latestPricePoint = newPricePoint.id
	token.dayPricePoints = appendToArray(token.dayPricePoints, newPricePoint.id)

	addFutureDayValueChange(token as IdeaToken, event.block.timestamp)
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	// Applies bonding curve math
	if (currentSupply.lt(market.hatchTokens)) {
		return bigIntToBigDecimal(market.baseCost, TEN_POW_18)
	}

	let updatedSupply = currentSupply.minus(market.hatchTokens)

	return bigIntToBigDecimal(
		market.baseCost.plus(updatedSupply.times(market.priceRise).div(BigInt.fromI32(10).pow(18))),
		TEN_POW_18
	)
}

export function updateTokenDayPriceChange(token: IdeaToken): void {
	// Updates the percentage day price change
	let dayPricePoints = token.dayPricePoints

	if (dayPricePoints.length == 0) {
		token.dayChange = BigDecimal.fromString('0')
		return
	}

	let startPricePoint = IdeaTokenPricePoint.load(first(dayPricePoints))
	let endPricePoint = IdeaTokenPricePoint.load(last(dayPricePoints))
	token.dayChange = endPricePoint.price.div(startPricePoint.oldPrice).minus(BigDecimal.fromString('1'))
}

function getRawBuyPrice(market: IdeaMarket, amount: BigInt, supply: BigInt): BigInt {
	let hatchCost = ZERO
	let updatedAmount = amount
	let updatedSupply: BigInt

	if (supply.lt(market.hatchTokens)) {
		let remainingHatchTokens = market.hatchTokens.minus(supply)

		if (amount.lt(remainingHatchTokens) || amount.equals(remainingHatchTokens)) {
			return market.baseCost.times(updatedAmount).div(TEN_POW_18_BIG_INT)
		}

		hatchCost = market.baseCost.times(remainingHatchTokens).div(TEN_POW_18_BIG_INT)
		updatedSupply = ZERO
		updatedAmount = amount.minus(remainingHatchTokens)
	} else {
		updatedSupply = supply.minus(market.hatchTokens)
	}

	let priceAtSupply = market.baseCost.plus(market.priceRise.times(updatedSupply).div(TEN_POW_18_BIG_INT))
	let priceAtSupplyPlusAmount = market.baseCost.plus(
		market.priceRise.times(updatedSupply.plus(updatedAmount)).div(TEN_POW_18_BIG_INT)
	)
	let average = priceAtSupply.plus(priceAtSupplyPlusAmount).div(BigInt.fromI32(2))

	return hatchCost.plus(average.times(updatedAmount).div(TEN_POW_18_BIG_INT))
}

function getTotalBuyPrice(market: IdeaMarket, amount: BigInt, supply: BigInt): BigInt {
	let rawCost = getRawBuyPrice(market, amount, supply)
	let tradingFee = rawCost.times(market.tradingFeeRate).div(FEE_SCALE)
	let platformFee = rawCost.times(market.platformFeeRate).div(FEE_SCALE)
	return rawCost.plus(tradingFee).plus(platformFee)
}

function getRawSellPrice(market: IdeaMarket, amount: BigInt, supply: BigInt): BigInt {
	let hatchPrice = ZERO
	let updatedAmount = amount
	let updatedSupply: BigInt

	if (supply.minus(amount).lt(market.hatchTokens)) {
		if (supply.lt(market.hatchTokens) || supply.equals(market.hatchTokens)) {
			return market.baseCost.times(amount).div(TEN_POW_18_BIG_INT)
		}

		let tokensInHatch = market.hatchTokens.minus(supply.minus(amount))
		hatchPrice = market.baseCost.times(tokensInHatch).div(TEN_POW_18_BIG_INT)
		updatedAmount = updatedAmount.minus(tokensInHatch)
		updatedSupply = supply.minus(market.hatchTokens)
	} else {
		updatedSupply = supply.minus(market.hatchTokens)
	}

	let priceAtSupply = market.baseCost.plus(market.priceRise.times(updatedSupply).div(TEN_POW_18_BIG_INT))
	let priceAtSupplyMinusAmount = market.baseCost.plus(
		market.priceRise.times(updatedSupply.minus(updatedAmount)).div(TEN_POW_18_BIG_INT)
	)
	let average = priceAtSupply.plus(priceAtSupplyMinusAmount).div(BigInt.fromI32(2))

	return hatchPrice.plus(average.times(updatedAmount).div(TEN_POW_18_BIG_INT))
}

function getTotalSellPrice(market: IdeaMarket, amount: BigInt, supply: BigInt): BigInt {
	let rawPrice = getRawSellPrice(market, amount, supply)
	let tradingFee = rawPrice.times(market.tradingFeeRate).div(FEE_SCALE)
	let platformFee = rawPrice.times(market.platformFeeRate).div(FEE_SCALE)
	return rawPrice.minus(tradingFee).minus(platformFee)
}
