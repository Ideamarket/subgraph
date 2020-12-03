import { Locked } from '../res/generated/IdeaTokenVault/IdeaTokenVault'
import { IdeaToken, IdeaTokenVault, LockedIdeaTokenAmount } from '../res/generated/schema'

export function handleLocked(event: Locked): void {
	const id = event.params.ideaToken.toHex() + '-' + event.params.owner.toHex() + '-' + event.params.index.toHex()

	const locked = new LockedIdeaTokenAmount(id)
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
	futureUnlockedAmounts.push(locked.id)
	vault.futureUnlockedAmounts = futureUnlockedAmounts
	vault.save()
}
