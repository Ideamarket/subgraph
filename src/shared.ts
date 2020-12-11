import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export let ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')
export let TEN_POW_18 = BigDecimal.fromString('1000000000000000000')

export function bigIntToBigDecimal(bigInt: BigInt, div: BigDecimal): BigDecimal {
	return bigInt.divDecimal(div)
}
