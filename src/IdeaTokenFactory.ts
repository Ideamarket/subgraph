import { Address, BigInt } from '@graphprotocol/graph-ts'
import {
    NewMarket,
    NewToken,
    OwnershipChanged
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import { IdeaMarket, IdeaToken } from '../res/generated/schema'

let zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')

export function handleNewMarket(event: NewMarket): void {
    let market = new IdeaMarket(event.params.id.toHex())

    market.marketID = event.params.id.toI32()
    market.name = event.params.name
    market.baseCost = event.params.baseCost
    market.priceRise = event.params.priceRise
    market.tokensPerInterval = event.params.tokensPerInterval
    market.tradingFeeRate = event.params.tradingFeeRate
    market.platformFeeRate = event.params.platformFeeRate

    market.save()
}

export function handleNewToken(event: NewToken): void {
    let market = IdeaMarket.load(event.params.marketID.toHex())
    if(!market) {
      throw 'IdeaMarket does not exist on NewToken event'
    }

    let token = new IdeaToken(event.params.addr.toHex())
    token.tokenID = event.params.id.toI32()
    token.market = market.id
    token.name = event.params.name
    token.supply = BigInt.fromI32(0)
    token.holders = 0
    token.marketCap = BigInt.fromI32(0)
    token.owner = zeroAddress

    token.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {}


/*
    // Entities can be loaded from the store using a string ID; this ID
    // needs to be unique across all entities of the same type
    let entity = TokenInfo.load(event.id.toHex())

    // Entities only exist after they have been saved to the store;
    // `null` checks allow to create entities on demand
    if (entity == null) {
      entity = new TokenInfo(event.id.toHex())
    }


    
    // BigInt and BigDecimal math are supported
    entity.count = entity.count + BigInt.fromI32(1)

    // Entity fields can be set based on event parameters
    entity.id = event.params.id
    entity.name = event.params.name

    // Entities can be written to the store with `.save()`
    entity.save()

    // Note: If a handler doesn't require existing field values, it is faster
    // _not_ to load the entity from the store. Instead, create it fresh with
    // `new Entity(...)`, set the fields that should be updated and save the
    // entity back to the store. Fields that were not set or unset remain
    // unchanged, allowing for partial updates to be applied.

    // It is also possible to access smart contracts from mappings. For
    // example, the contract that has emitted the event can be connected to
    // with:
    //
    // let contract = Contract.bind(event.address)
    //
    // The following functions can then be called on this contract to access
    // state variables and other data:
    //
    // - contract.getOwner(...)
    // - contract.isValidTokenName(...)
    // - contract.getMarketIDByName(...)
    // - contract.getMarketDetailsByID(...)
    // - contract.getMarketDetailsByName(...)
    // - contract.getNumMarkets(...)
    // - contract.getTokenIDByName(...)
    // - contract.getTokenInfo(...)
    // - contract.getTokenIDPair(...)
  */