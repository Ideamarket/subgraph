import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import {
	Transfer,
	Approval,
	OwnershipChanged
} from '../res/generated/IdeaToken/IdeaToken'
import { IdeaToken, IdeaTokenBalance, IdeaTokenAllowance, IdeaMarket, IdeaTokenPricePoint } from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')
const tenPow18 = BigDecimal.fromString('1000000000000000000')

export function handleTransfer(event: Transfer): void {
	const token = IdeaToken.load(event.address.toHex())
	if(!token) {
		return
	}
	const market = IdeaMarket.load(token.market)
	if(!market) {
		throw 'Market does not exist on Transfer event'
	}

	if(event.params.from.equals(zeroAddress)) {
		token.supply = token.supply.plus(event.params.value)
		makePricePoint(market as IdeaMarket, token.id, token.supply, event.block.timestamp, event.block.number, event.transaction.index)
	} else {
		const fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
		if (!fromBalance) {
			throw 'FromBalance is not defined on Transfer event'
		}
		fromBalance.amount = fromBalance.amount.minus(event.params.value)
		fromBalance.save()

		if(fromBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders - 1
		}
	}

	if(event.params.to.equals(zeroAddress)) {
		token.supply = token.supply.minus(event.params.value)
		makePricePoint(market as IdeaMarket, token.id, token.supply, event.block.timestamp, event.block.number, event.transaction.index)
	} else {
		let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
		if (!toBalance) {
			toBalance = new IdeaTokenBalance(event.params.to.toHex())
			toBalance.token = token.id
			toBalance.amount = BigInt.fromI32(0)
		}
		const beforeBalance = toBalance.amount
		toBalance.amount = toBalance.amount.plus(event.params.value)
		toBalance.save()

		if(beforeBalance.equals(BigInt.fromI32(0)) && !toBalance.amount.equals(BigInt.fromI32(0))) {
			token.holders = token.holders + 1
		}
	}

	token.save()
}

export function handleApproval(event: Approval): void {
	const token = IdeaToken.load(event.address.toHex())
	if(!token) {
		return
	}

	const allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
	let allowance = IdeaTokenAllowance.load(allowanceID)
	if(!allowance) {
		allowance = new IdeaTokenAllowance(allowanceID)
		allowance.token = token.id
		allowance.amount = BigInt.fromI32(0)
	}

	allowance.amount = allowance.amount.plus(event.params.value)
	allowance.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	const token = IdeaToken.load(event.address.toHex())
	if(!token) {
		return
	}

	token.owner = event.params.newOwner
	token.save()
}

function makePricePoint(market: IdeaMarket, tokenID: string, supply: BigInt, timestamp: BigInt, block: BigInt, txindex: BigInt): void {
	const pricePoint = new IdeaTokenPricePoint(tokenID + '-' + block.toHex() + '-' + txindex.toHex())
	pricePoint.token = tokenID
	pricePoint.timestamp = timestamp
	pricePoint.block = block
	pricePoint.txindex = txindex
	pricePoint.price = calculateDecimalPriceFromSupply(supply, market)
	pricePoint.save()
}

function calculateDecimalPriceFromSupply(currentSupply: BigInt, market: IdeaMarket): BigDecimal {
	return market.baseCost.plus(currentSupply.times(market.priceRise)).toBigDecimal().div(tenPow18.times(tenPow18))
}
