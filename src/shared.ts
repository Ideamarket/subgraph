import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { BlockHandlerValues, FutureDayValueChange, IdeaToken } from '../res/generated/schema'

export let ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')
export let ZERO = BigInt.fromI32(0)
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
	let id = token.id + '-' + currentTs.toString()
	let futureDayValueChange = FutureDayValueChange.load(id)
	if (!futureDayValueChange) {
		futureDayValueChange = new FutureDayValueChange(id)
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
export function appendToArray(array: string[], append: string): string[] {
	array.push(append)
	return array
}

export function swapArrayIndices(array: string[], i: i32, j: i32): string[] {
	let cpy = array[i]
	array[i] = array[j]
	array[j] = cpy
	return array
}

export function first(array: string[]): string {
	return array[0]
}

export function last(array: string[]): string {
	return array[array.length - 1]
}
