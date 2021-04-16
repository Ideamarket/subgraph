# Ideamarket Subgraph

This repo contains the Subgraph for the Ideamarket contracts.

### Usage

-   Build: `npm run build:<NETWORK> [--branch=<BRANCH>] [--startblock=<STARTBLOCK>]`

    -   `NETWORK`: Can be `mainnet`, `rinkeby` or `test`
    -   `branch`: Optional argument. Defines which branch of the `ideamarket-contracts` repository is used. Default: `master`
    -   `startblock`: Optional argument. Defines on which block the subgraph should start syncing.

-   Deploy: `npx graph deploy --node <NODE> --ipfs <IPFS> <NAME>`
    -   `NODE`: URL of the graph node
    -   `IPFS`: URL of the IPFS node
    -   `NAME`: The name of the subgraph

### Further documentation

See the [official The Graph documentation](https://thegraph.com/docs/introduction) for information on how to alter and query a subgraph.
