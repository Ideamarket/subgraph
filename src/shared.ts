import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { BlockHandlerValues, FutureDayValueChange, IdeaToken } from '../res/generated/schema'

export let ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')
export let TEN_POW_18 = BigDecimal.fromString('1000000000000000000')
export let SECONDS_PER_DAY = 86400

export function bigIntToBigDecimal(bigInt: BigInt, div: BigDecimal): BigDecimal {
	return bigInt.divDecimal(div)
}

export function loadBlockHandlerValues(): BlockHandlerValues {
	let v = BlockHandlerValues.load('blockhandler')

	if (!v) {
		v = new BlockHandlerValues('blockhandler')
		v.futureUnlockedAmounts = []
		v.futureDayValueChanges = []
	}

	return v as BlockHandlerValues
}

export function addFutureDayValueChange(token: IdeaToken, currentTs: BigInt): void {
	let futureDayValueChange = FutureDayValueChange.load(token.id + '-' + currentTs.toString())
	if (!futureDayValueChange) {
		futureDayValueChange.token = token.id
		futureDayValueChange.ts = currentTs.plus(BigInt.fromI32(SECONDS_PER_DAY))
		futureDayValueChange.save()

		let values = loadBlockHandlerValues()
		let currentArray = values.futureDayValueChanges
		currentArray.push(futureDayValueChange.id)
		values.futureDayValueChanges = currentArray
		values.save()
	}
}
