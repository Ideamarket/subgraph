import { Locked } from '../res/generated/IdeaTokenVault/IdeaTokenVault'
import { IdeaToken, IdeaTokenVault, LockedIdeaTokenAmount } from '../res/generated/schema'

export function handleLocked(event: Locked): void {
	const locked = new LockedIdeaTokenAmount(event.transaction.hash.toHex() + '-' + event.logIndex.toHex())
	locked.token = event.params.ideaToken.toHex()
	locked.owner = event.params.owner
	locked.amount = event.params.lockedAmount
	locked.lockedUntil = event.params.lockedUntil
	locked.save()

	const token = IdeaToken.load(event.params.ideaToken.toHex())
	if (!token) {
		throw 'IdeaToken does not exist on handleLocked event'
	}

	token.lockedAmount = token.lockedAmount.plus(event.params.lockedAmount)
	token.save()

	let vault = IdeaTokenVault.load('vault')
	if (!vault) {
		vault = new IdeaTokenVault('vault')
		vault.futureUnlockedAmounts = []
	}

	const futureUnlockedAmounts = vault.futureUnlockedAmounts
	const insertIndex = getInsertionIndex(futureUnlockedAmounts, locked)
	vault.futureUnlockedAmounts = insert(futureUnlockedAmounts, insertIndex, locked.id)
	vault.save()
}

// AS does not support splice()
function insert(array: string[], index: number, value: string): string[] {
	const left = array.slice(0 as i32, index as i32)
	const right = array.slice(index as i32)

	return left.concat([value]).concat(right)
}

// Do binary search to find insertion point to keep the list ordered ascending by lockedUntil
function getInsertionIndex(array: string[], entry: LockedIdeaTokenAmount): number {
	let low = 0
	let high = array.length

	while (low < high) {
		const mid = low + high >>> 1

		const elem = LockedIdeaTokenAmount.load(array[mid])
		if(!elem) {
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