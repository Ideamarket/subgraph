import { BigInt } from '@graphprotocol/graph-ts'
import {
  TokensBought,
  TokensSold,
} from '../res/generated/IdeaTokenExchange/IdeaTokenExchange'
import { IdeaToken } from '../res/generated/schema'

export function handleTokensBought(event: TokensBought): void {
    let token = IdeaToken.load(event.params.ideaToken.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on TokensBought event'
    }

    token.marketCap = token.marketCap.plus(event.params.rawCost)
    token.save()
}

export function handleTokensSold(event: TokensSold): void {
    let token = IdeaToken.load(event.params.ideaToken.toHex())
    if(!token) {
        throw 'IdeaToken does not exist on TokensSold event'
    }

    token.marketCap = token.marketCap.plus(event.params.rawPrice)
    token.save()
}