import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { Transfer, Approval, OwnershipChanged } from '../res/generated/IdeaToken/IdeaToken'
import {
	IdeaToken,
	IdeaTokenBalance,
	IdeaTokenAllowance,
	IdeaMarket,
	IdeaTokenPricePoint,
} from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')
const tenPow18 = BigDecimal.fromString('1000000000000000000')

export function handleTransfer(event: Transfer): void {
	const token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}
	const market = IdeaMarket.load(token.market)
	if (!market) {
		throw 'Market does not exist on Transfer event'
	}

	if (event.params.from.equals(zeroAddress)) {
		token.supply = token.supply.plus(event.params.value)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
	} else {
		const fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
		if (!fromBalance) {
			throw 'FromBalance is not defined on Transfer event'
		}
		fromBalance.amount = fromBalance.amount.minus(event.params.value)
		fromBalance.save()

		if (fromBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders - 1
		}
	}

	if (event.params.to.equals(zeroAddress)) {
		token.supply = token.supply.minus(event.params.value)
		addPricePoint(token as IdeaToken, market as IdeaMarket, event as Transfer)
	} else {
		let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
		if (!toBalance) {
			toBalance = new IdeaTokenBalance(event.params.to.toHex() + '-' + token.id)
			toBalance.holder = event.params.to
			toBalance.amount = BigInt.fromI32(0)
			toBalance.token = token.id
			toBalance.market = market.id
		}
		const beforeBalance = toBalance.amount
		toBalance.amount = toBalance.amount.plus(event.params.value)
		toBalance.save()

		if (beforeBalance.equals(BigInt.fromI32(0)) && !toBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders + 1
		}
	}

	token.save()
}

export function handleApproval(event: Approval): void {
	const token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}

	const allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
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
	const token = IdeaToken.load(event.address.toHex())
	if (!token) {
		return
	}

	token.owner = event.params.newOwner
	token.save()
}

function addPricePoint(token: IdeaToken, market: IdeaMarket, event: Transfer): void {
	const lastIndex = token.pricePoints.length - 1
	const cpy = token.pricePoints
	const oldPricePoint = IdeaTokenPricePoint.load(cpy[lastIndex])

	if (oldPricePoint.block === event.block.number && oldPricePoint.txindex === event.transaction.index) {
		oldPricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
		oldPricePoint.save()
	} else {
		const newPricePoint = new IdeaTokenPricePoint(
			token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex()
		)
		newPricePoint.token = token.id
		newPricePoint.timestamp = event.block.timestamp
		newPricePoint.block = event.block.number
		newPricePoint.txindex = event.transaction.index
		newPricePoint.oldPrice = oldPricePoint.price
		newPricePoint.price = calculateDecimalPriceFromSupply(token.supply, market)
		newPricePoint.save()

		const pricePoints = token.pricePoints
		pricePoints.push(newPricePoint.id)
		token.pricePoints = pricePoints
	}
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	if (currentSupply.lt(market.hatchTokens)) {
		return market.baseCost.toBigDecimal().div(tenPow18)
	}

	const updatedSupply = currentSupply.minus(market.hatchTokens)

	return market.baseCost
		.plus(updatedSupply.times(market.priceRise).div(BigInt.fromI32(10).pow(18)))
		.toBigDecimal()
		.div(tenPow18)
}
