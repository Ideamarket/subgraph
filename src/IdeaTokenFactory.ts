import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	NewNameVerifier,
	OwnershipChanged,
	NewPlatformFee,
	NewTradingFee
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import {
	FutureDayValueChange,
	IdeaMarket,
	IdeaToken,
	IdeaTokenFactory,
	IdeaTokenPricePoint,
	IdeaTokenVolumePoint,
	LockedIdeaTokenAmount,
} from '../res/generated/schema'

import { updateLockedPercentage } from './IdeaTokenVault'
import { updateTokenDayPriceChange } from './IdeaToken'
import { updateTokenDayVolume } from './IdeaTokenExchange'
import {
	TEN_POW_18,
	ZERO_ADDRESS,
	ZERO,
	SECONDS_PER_DAY,
	bigIntToBigDecimal,
	loadBlockHandlerValues,
	addFutureDayValueChange,
} from './shared'

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

export function handleBlock(block: ethereum.Block): void {
	checkDayValues(block)
	checkLockedTokens(block)
}

function checkDayValues(block: ethereum.Block): void {
	let blockHandlerValues = loadBlockHandlerValues()
	let futureDayValueChanges = blockHandlerValues.futureDayValueChanges
	let currentTS = block.timestamp
	let minTS = currentTS.minus(BigInt.fromI32(SECONDS_PER_DAY))
	let numDrop = 0

	for (let i = 0; i < blockHandlerValues.futureDayValueChanges.length; i++) {
		let futureDayValueChange = FutureDayValueChange.load(futureDayValueChanges[i])
		if (!futureDayValueChange) {
			throw 'Failed to load FutureDayValueChange in checkDayValues'
		}

		if (currentTS.lt(futureDayValueChange.ts)) {
			break
		}

		numDrop++

		let token = IdeaToken.load(futureDayValueChange.token)
		if (!token) {
			throw 'Failed to load token in checkDayValues'
		}

		// ---- Price Points
		let dayPricePoints = token.dayPricePoints
		let dropPricePointsUntilIndex = 0
		for (; dropPricePointsUntilIndex < dayPricePoints.length; dropPricePointsUntilIndex++) {
			let pricePoint = IdeaTokenPricePoint.load(dayPricePoints[dropPricePointsUntilIndex])
			if (!pricePoint) {
				throw 'Failed to load price point in checkDayValues'
			}

			if (pricePoint.timestamp.gt(minTS)) {
				break
			}
		}

		if (dropPricePointsUntilIndex !== 0) {
			token.dayPricePoints = dayPricePoints.slice(dropPricePointsUntilIndex)
			updateTokenDayPriceChange(token as IdeaToken)
		}

		// ---- Volume Points
		let dayVolumePoints = token.dayVolumePoints
		let dropVolumePointsUntilIndex = 0
		for (; dropVolumePointsUntilIndex < dayVolumePoints.length; dropVolumePointsUntilIndex++) {
			let volumePoint = IdeaTokenVolumePoint.load(dayVolumePoints[dropVolumePointsUntilIndex])
			if (!volumePoint) {
				throw 'Failed to load volume point in checkDayValues'
			}

			if (volumePoint.timestamp.gt(minTS)) {
				break
			}
		}

		if (dropVolumePointsUntilIndex !== 0) {
			token.dayVolumePoints = dayVolumePoints.slice(dropVolumePointsUntilIndex)
			updateTokenDayVolume(token as IdeaToken)
		}

		token.save()
	}

	if (numDrop > 0) {
		blockHandlerValues.futureDayValueChanges = futureDayValueChanges.slice(numDrop)
		blockHandlerValues.save()
	}
}

function checkLockedTokens(block: ethereum.Block): void {
	let blockHandlerValues = loadBlockHandlerValues()

	let futureUnlockedAmounts = blockHandlerValues.futureUnlockedAmounts
	let currentTS = block.timestamp

	// Iterate over `futureUnlockedAmounts`
	let hadChange = false
	while (futureUnlockedAmounts.length > 0) {
		let futureUnlockedAmount = LockedIdeaTokenAmount.load(futureUnlockedAmounts[0])
		if (!futureUnlockedAmount) {
			throw 'LockedIdeaTokenAmount not found'
		}

		// The list is ordered ascending. We can exit early
		if (currentTS.lt(futureUnlockedAmount.lockedUntil)) {
			break
		}

		hadChange = true

		let token = IdeaToken.load(futureUnlockedAmount.token)
		if (!token) {
			throw 'IdeaToken not found'
		}

		// Update the tokens locked amount and percentage
		token.lockedAmount = token.lockedAmount.minus(futureUnlockedAmount.amount)
		updateLockedPercentage(token as IdeaToken)
		token.save()

		// Drop this `LockedIdeaTokenAmount` from the list
		futureUnlockedAmounts.shift()
	}

	// Only save when we had a change, this saves sync time
	if (hadChange) {
		blockHandlerValues.futureUnlockedAmounts = futureUnlockedAmounts
		blockHandlerValues.save()
	}
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
	market.platformFeeWithdrawer = ZERO_ADDRESS
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

	let pricePointID = tokenID + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
	let pricePoint = new IdeaTokenPricePoint(pricePointID)
	pricePoint.token = tokenID
	pricePoint.timestamp = event.block.timestamp
	pricePoint.block = event.block.number
	pricePoint.txindex = event.transaction.index
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
	token.owner = ZERO_ADDRESS
	token.interestWithdrawer = ZERO_ADDRESS
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