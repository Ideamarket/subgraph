import { Locked } from '../res/generated/IdeaTokenVault/IdeaTokenVault'
import { IdeaToken, IdeaTokenVault, LockedIdeaTokenAmount } from '../res/generated/schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { TEN_POW_18, bigIntToBigDecimal } from './shared'

export function handleLocked(event: Locked): void {
	// Create a new `LockedIdeaTokenAmount`
	let locked = new LockedIdeaTokenAmount(event.transaction.hash.toHex() + '-' + event.logIndex.toHex())
	locked.token = event.params.ideaToken.toHex()
	locked.owner = event.params.owner
	locked.amount = event.params.lockedAmount
	locked.lockedUntil = event.params.lockedUntil
	locked.save()

	let token = IdeaToken.load(event.params.ideaToken.toHex())
	if (!token) {
		throw 'IdeaToken does not exist on handleLocked event'
	}

	// Update the locked amount and percentage on the IdeaToken
	token.lockedAmount = token.lockedAmount.plus(event.params.lockedAmount)
	updateLockedPercentage(token as IdeaToken)
	token.save()

	// The `vault` entity might not exist yet.
	let vault = IdeaTokenVault.load('vault')
	if (!vault) {
		vault = new IdeaTokenVault('vault')
		vault.futureUnlockedAmounts = []
	}

	// Insert the new `LockedIdeaTokenAmount` into the ordered list of `LockedIdeaTokenAmount`s
	let futureUnlockedAmounts = vault.futureUnlockedAmounts
	let insertIndex = getInsertionIndex(futureUnlockedAmounts, locked)
	vault.futureUnlockedAmounts = insert(futureUnlockedAmounts, insertIndex, locked.id)
	vault.save()
}

export function updateLockedPercentage(token: IdeaToken): void {
	// The supply of the token could be zero. Make sure we don't div by zero
	if (token.supply.gt(BigInt.fromI32(0))) {
		token.lockedPercentage = bigIntToBigDecimal(token.lockedAmount, TEN_POW_18).div(
			bigIntToBigDecimal(token.supply, TEN_POW_18)
		)
	} else {
		token.lockedPercentage = BigDecimal.fromString('0.0')
	}
}

// AS does not support splice()
function insert(array: string[], index: number, value: string): string[] {
	let left = array.slice(0 as i32, index as i32)
	let right = array.slice(index as i32)

	return left.concat([value]).concat(right)
}

// Does binary search to find insertion point to keep the list ordered ascending by lockedUntil
function getInsertionIndex(array: string[], entry: LockedIdeaTokenAmount): number {
	let low = 0
	let high = array.length

	while (low < high) {
		let mid = (low + high) >>> 1

		let elem = LockedIdeaTokenAmount.load(array[mid])
		if (!elem) {
			throw 'getInsertionIndex: LockedIdeaTokenAmount not found'
		}

		if (elem.lockedUntil.lt(entry.lockedUntil)) {
			low = mid + 1
		} else {
			high = mid
		}
	}

	return low
}
