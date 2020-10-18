import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
	NewMarket,
	NewToken,
	OwnershipChanged
} from '../res/generated/IdeaTokenFactory/IdeaTokenFactory'
import { IdeaMarket, IdeaToken, IdeaTokenFactory, IdeaTokenMarketCapPoint, IdeaTokenPricePoint } from '../res/generated/schema'

const zeroAddress = Address.fromString('0x0000000000000000000000000000000000000000')

export function handleNewMarket(event: NewMarket): void {
	const market = new IdeaMarket(event.params.id.toHex())

	market.marketID = event.params.id.toI32()
	market.name = event.params.name
	market.baseCost = event.params.baseCost
	market.priceRise = event.params.priceRise
	market.tradingFeeRate = event.params.tradingFeeRate
	market.platformFeeRate = event.params.platformFeeRate

	market.save()
}

export function handleNewToken(event: NewToken): void {
	const market = IdeaMarket.load(event.params.marketID.toHex())
	if(!market) {
		throw 'IdeaMarket does not exist on NewToken event'
	}

	const token = new IdeaToken(event.params.addr.toHex())
	token.tokenID = event.params.id.toI32()
	token.market = market.id
	token.name = event.params.name
	token.supply = BigInt.fromI32(0)
	token.holders = 0
	token.marketCap = BigInt.fromI32(0)
	token.owner = zeroAddress
	token.save()
  
	// Initial price and market cap points
	const marketCapPoint = new IdeaTokenMarketCapPoint(token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex())
	marketCapPoint.token = token.id
	marketCapPoint.timestamp = event.block.timestamp
	marketCapPoint.block = event.block.number
	marketCapPoint.txindex = event.transaction.index
	marketCapPoint.marketCap = BigDecimal.fromString('0')
	marketCapPoint.save()

	const pricePoint = new IdeaTokenPricePoint(token.id + '-' + event.block.number.toHex() + '-' + event.transaction.index.toHex())
	const tenPow18 = BigDecimal.fromString('1000000000000000000')
	pricePoint.token = token.id
	pricePoint.timestamp = event.block.timestamp
	pricePoint.block = event.block.number
	pricePoint.txindex = event.transaction.index
	pricePoint.price = market.baseCost.toBigDecimal().div(tenPow18)
	pricePoint.save()
}

export function handleOwnershipChanged(event: OwnershipChanged): void {
	let factory = IdeaTokenFactory.load(event.address.toHex())
	if(!factory) {
		factory = new IdeaTokenFactory(event.address.toHex())
	}

	factory.owner = event.params.newOwner

	factory.save()
}


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