import { Address, BigInt } from '@graphprotocol/graph-ts'
import {
  Transfer,
  Approval,
  OwnershipChanged
} from '../build/generated/IdeaToken/IdeaToken'
import { IdeaToken, IdeaTokenBalance, IdeaTokenAllowance } from '../build/generated/schema'

const zeroAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')

export function handleTransfer(event: Transfer): void {
    const token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on Transfer event'
    }

    if(event.params.from.equals(zeroAddress)) {
        token.supply = token.supply.plus(event.params.value)
    } else {
        const fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
        if (!fromBalance) {
            throw 'FromBalance is not defined on Transfer event'
        }
        fromBalance.amount = fromBalance.amount.minus(event.params.value)
        fromBalance.save()
    }

    if(event.params.to.equals(zeroAddress)) {
        token.supply = token.supply.minus(event.params.value)
    } else {
        let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
        if (!toBalance) {
            toBalance = new IdeaTokenBalance(event.params.to.toHex())
            toBalance.amount = BigInt.fromI32(0)
        }
        toBalance.amount = toBalance.amount.plus(event.params.value)
        toBalance.save()
    }

    token.save()
}

export function handleApproval(event: Approval): void {
    const token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on Approve event'
    }

    const allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
    let allowance = IdeaTokenAllowance.load(allowanceID)
    if(!allowance) {
        allowance = new IdeaTokenAllowance(allowanceID)
        allowance.amount = BigInt.fromI32(0)
    }

    allowance.amount = allowance.amount.plus(event.params.value)
    allowance.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
    const token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on OwnershipChanged event'
    }

    token.owner = event.params.newOwner
    token.save()
}
