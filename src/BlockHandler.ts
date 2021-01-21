import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
	FutureDayValueChange,
	IdeaToken,
	IdeaTokenPricePoint,
	IdeaTokenVolumePoint,
	LockedIdeaTokenAmount,
} from '../res/generated/schema'

import { updateLockedPercentage } from './IdeaTokenVault'
import { updateTokenDayPriceChange } from './IdeaToken'
import { updateTokenDayVolume } from './IdeaTokenExchange'
import { SECONDS_PER_DAY, loadBlockHandlerValues, first } from './shared'

export function blockHandler(block: ethereum.Block): void {
	checkDayValues(block)
	checkLockedTokens(block)
}

function checkDayValues(block: ethereum.Block): void {
	let blockHandlerValues = loadBlockHandlerValues()
	let futureDayValueChanges = blockHandlerValues.futureDayValueChanges
	let currentTS = block.timestamp
	let minTS = currentTS.minus(BigInt.fromI32(SECONDS_PER_DAY))
	let numDrop = 0

	for (let i = 0; i < futureDayValueChanges.length; i++) {
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
		let futureUnlockedAmount = LockedIdeaTokenAmount.load(first(futureUnlockedAmounts))
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
