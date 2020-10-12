import { Address, BigInt } from '@graphprotocol/graph-ts'
import {
  Transfer,
  Approval,
  OwnershipChanged
} from '../res/generated/IdeaToken/IdeaToken'
import { IdeaToken, IdeaTokenBalance, IdeaTokenAllowance } from '../res/generated/schema'

let zeroAddress = Address.fromHexString('0x0000000000000000000000000000000000000000')

export function handleTransfer(event: Transfer): void {
    let token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on Transfer event'
    }

    if(event.params.from.equals(zeroAddress)) {
        token.supply = token.supply.plus(event.params.value)
    } else {
        let fromBalance = IdeaTokenBalance.load(event.params.from.toHex() + '-' + token.id)
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
    } else {
        let toBalance = IdeaTokenBalance.load(event.params.to.toHex() + '-' + token.id)
        if (!toBalance) {
            toBalance = new IdeaTokenBalance(event.params.to.toHex())
            toBalance.amount = BigInt.fromI32(0)
        }
        let beforeBalance = toBalance.amount
        toBalance.amount = toBalance.amount.plus(event.params.value)
        toBalance.save()

        if(beforeBalance.equals(BigInt.fromI32(0)) && !toBalance.amount.equals(BigInt.fromI32(0))) {
            token.holders = token.holders + 1
        }
    }

    token.save()
}

export function handleApproval(event: Approval): void {
    let token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on Approve event'
    }

    let allowanceID = event.params.owner.toHex() + '-' + event.params.spender.toHex() + '-' + token.id
    let allowance = IdeaTokenAllowance.load(allowanceID)
    if(!allowance) {
        allowance = new IdeaTokenAllowance(allowanceID)
        allowance.amount = BigInt.fromI32(0)
    }

    allowance.amount = allowance.amount.plus(event.params.value)
    allowance.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
    let token = IdeaToken.load(event.address.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on OwnershipChanged event'
    }

    token.owner = event.params.newOwner
    token.save()
}
