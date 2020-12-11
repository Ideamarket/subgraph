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
	IdeaTokenVault,
	IdeaTokenVolumePoint,
	LockedIdeaTokenAmount,
} from '../res/generated/schema'

import { updateLockedPercentage } from './IdeaTokenVault'
import { TEN_POW_18, ZERO_ADDRESS, bigIntToBigDecimal } from './shared'

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
	checkDayPriceAndVolumePoints(block)
	checkLockedTokens(block)
}

function checkDayPriceAndVolumePoints(block: ethereum.Block): void {
	let factory = IdeaTokenFactory.load('factory')
	if (!factory) {
		return
	}

	let currentTS = block.timestamp
	let minTS = currentTS.minus(BigInt.fromI32(86400))

	for (let i = 0; i < factory.allTokens.length; i++) {
		let allTokens = factory.allTokens
		let token = IdeaToken.load(allTokens[i])
		if (!token) {
			throw 'Failed to load token in handleBlock'
		}

		// ---- Price Points
		let dayPricePoints = token.dayPricePoints
		let dropPricePointsUntilIndex = 0
		for (; dropPricePointsUntilIndex < dayPricePoints.length; dropPricePointsUntilIndex++) {
			let pricePoint = IdeaTokenPricePoint.load(dayPricePoints[dropPricePointsUntilIndex])
			if (!pricePoint) {
				throw 'Failed to load price point in handleBlock'
			}

			if (pricePoint.timestamp.gt(minTS)) {
				break
			}
		}

		let updatePricePoints = false
		if (dropPricePointsUntilIndex !== 0) {
			token.dayPricePoints = dayPricePoints.slice(dropPricePointsUntilIndex + 1, token.dayPricePoints.length)
			updatePricePoints = true
		} else if (dayPricePoints.length > 0) {
			let latest = IdeaTokenPricePoint.load(token.latestPricePoint)
			if (latest.timestamp.equals(currentTS)) {
				updatePricePoints = true
			}
		}

		if (updatePricePoints) {
			dayPricePoints = token.dayPricePoints
			if (dayPricePoints.length === 0) {
				token.dayChange = BigDecimal.fromString('0')
			} else {
				let startPricePoint = IdeaTokenPricePoint.load(dayPricePoints[0])
				let endPricePoint = IdeaTokenPricePoint.load(dayPricePoints[dayPricePoints.length - 1])
				token.dayChange = endPricePoint.price.div(startPricePoint.oldPrice).minus(BigDecimal.fromString('1'))
			}
		}

		// ---- Volume Points
		let dayVolumePoints = token.dayVolumePoints
		let dropVolumePointsUntilIndex = 0
		for (; dropVolumePointsUntilIndex < dayVolumePoints.length; dropVolumePointsUntilIndex++) {
			let volumePoint = IdeaTokenVolumePoint.load(dayVolumePoints[dropVolumePointsUntilIndex])
			if (!volumePoint) {
				throw 'Failed to load volume point in handleBlock'
			}

			if (volumePoint.timestamp.gt(minTS)) {
				break
			}
		}

		let updateVolumePoints = false
		if (dropVolumePointsUntilIndex !== 0) {
			token.dayVolumePoints = dayVolumePoints.slice(dropVolumePointsUntilIndex + 1, token.dayVolumePoints.length)
			updateVolumePoints = true
		} else if (dayVolumePoints.length > 0) {
			let latest = IdeaTokenVolumePoint.load(dayVolumePoints[dayVolumePoints.length - 1])
			if (latest.timestamp.equals(currentTS)) {
				updateVolumePoints = true
			}
		}

		if (updateVolumePoints) {
			dayVolumePoints = token.dayVolumePoints
			let dayVolume = BigDecimal.fromString('0')
			for (let c = 0; c < dayVolumePoints.length; c++) {
				let volumePoint = IdeaTokenVolumePoint.load(dayVolumePoints[c])
				dayVolume = dayVolume.plus(volumePoint.volume)
			}
			token.dayVolume = dayVolume
		}

		if (updatePricePoints || updateVolumePoints) {
			token.save()
		}
	}
}

function checkLockedTokens(block: ethereum.Block): void {
	// If the `vault` is not created yet there can be no locked entries
	let vault = IdeaTokenVault.load('vault')
	if (!vault) {
		return
	}

	let futureUnlockedAmounts = vault.futureUnlockedAmounts
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
		vault.futureUnlockedAmounts = futureUnlockedAmounts
		vault.save()
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
	market.platformFeeInvested = BigInt.fromI32(0)
	market.nameVerifier = event.params.nameVerifier
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
	token.supply = BigInt.fromI32(0)
	token.holders = 0
	token.marketCap = BigInt.fromI32(0)
	token.owner = ZERO_ADDRESS
	token.interestWithdrawer = ZERO_ADDRESS
	token.daiInToken = BigInt.fromI32(0)
	token.invested = BigInt.fromI32(0)
	token.dayChange = BigDecimal.fromString('0')
	token.dayVolume = BigDecimal.fromString('0')
	token.listedAt = event.block.timestamp
	token.lockedAmount = BigInt.fromI32(0)
	token.lockedPercentage = BigDecimal.fromString('0.0')
	token.latestPricePoint = pricePointID
	token.dayPricePoints = [pricePointID]
	token.dayVolumePoints = []
	token.save()

	let factory = IdeaTokenFactory.load('factory')
	if (!factory) {
		throw 'IdeaTokenFactory does not exist on NewToken event'
	}
	let allTokens = factory.allTokens
	allTokens.push(tokenID)
	factory.allTokens = allTokens
	factory.save()
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
		factory.allTokens = []
	}

	factory.owner = event.params.newOwner
	factory.save()
}
