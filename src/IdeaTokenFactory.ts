import { BigInt } from '@graphprotocol/graph-ts'
import {
  NewMarket,
  NewToken,
  OwnershipChanged
} from '../build/generated/IdeaTokenFactory/IdeaTokenFactory'

export function handleNewMarket(event: NewMarket): void {
}

export function handleNewToken(event: NewToken): void {}

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