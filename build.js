/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const fs = require('fs')
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const { exec } = require('child_process')
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const path = require('path')

const buildDir = './res'
const abiDir = './abis'
const contractsRepo = 'github.com/ideamarket/ideamarket-contracts.git'

const allContracts = {
	evm: [
		{
			contractName: 'IdeaTokenVault',
			deployedName: 'ideaTokenVault',
			abiPath: 'shared/core/IdeaTokenVault.sol/IdeaTokenVault.json',
		},
		{
			contractName: 'IdeaToken',
			deployedName: 'ideaToken',
			abiPath: 'shared/core/IdeaToken.sol/IdeaToken.json',
		},
		{
			contractName: 'IdeaTokenFactory',
			deployedName: 'ideaTokenFactory',
			abiPath: 'evm/core/IdeaTokenFactory.sol/IdeaTokenFactory.json',
		},
		{
			contractName: 'IdeaTokenExchange',
			deployedName: 'ideaTokenExchange',
			abiPath: 'evm/core/IdeaTokenExchange.sol/IdeaTokenExchange.json',
		},
	],
	avm: [
		{
			contractName: 'IdeaTokenVault',
			deployedName: 'ideaTokenVault',
			abiPath: 'shared/core/IdeaTokenVault.sol/IdeaTokenVault.json',
		},
		{
			contractName: 'IdeaToken',
			deployedName: 'ideaToken',
			abiPath: 'shared/core/IdeaToken.sol/IdeaToken.json',
		},
		{
			contractName: 'IdeaTokenFactory',
			deployedName: 'ideaTokenFactoryAVM',
			abiPath: 'avm/core/IdeaTokenFactoryAVM.sol/IdeaTokenFactoryAVM.json',
		},
		{
			contractName: 'IdeaTokenExchange',
			deployedName: 'ideaTokenExchangeAVM',
			abiPath: 'avm/core/IdeaTokenExchangeAVM.sol/IdeaTokenExchangeAVM.json',
		},
	],
}

const networks = {
	mainnet: {
		name: 'mainnet',
		realNetworkName: 'mainnet',
		startBlock: 11830000,
	},
	rinkeby: {
		name: 'rinkeby',
		realNetworkName: 'rinkeby',
		startBlock: 8086000,
	},
	test: {
		name: 'test',
		realNetworkName: 'rinkeby',
		startBlock: 8055800,
	},
	'test-avm-l1': {
		name: 'test-avm-l1',
		realNetworkName: 'rinkeby',
		startBlock: 9107630,
	},
	'test-avm-l2': {
		name: 'test-avm-l2',
		realNetworkName: 'arbitrum-one',
		startBlock: 9107630,
	},
}

let contracts
let network

async function main() {
	let startBlock = 0
	let branch = 'master'

	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === '--rinkeby') {
			network = networks.rinkeby
			contracts = allContracts.evm
		} else if (process.argv[i] === '--test') {
			network = networks.test
			contracts = allContracts.evm
		} else if (process.argv[i] === '--test-avm-l1') {
			network = networks['test-avm-l1']
			contracts = allContracts.evm
		} else if (process.argv[i] === '--test-avm-l2') {
			network = networks['test-avm-l2']
			contracts = allContracts.avm
		} else if (process.argv[i] === '--mainnet') {
			network = networks.mainnet
			contracts = allContracts.evm
		} else if (process.argv[i] === '--branch') {
			const val = process.argv[i + 1]
			if (!val || val.startsWith('$') || val.startsWith('%')) {
				continue
			}
			branch = val
		} else if (process.argv[i] === '--start-block') {
			const val = process.argv[i + 1]
			if (!val || val.startsWith('$') || val.startsWith('%')) {
				continue
			}
			startBlock = parseInt(val)
		}
	}

	console.log(`> Using network ${network.name}`)
	console.log(`> Using branch ${branch}`)
	console.log(startBlock > 0 ? `> Using startblock ${startBlock}` : `> Using hardcoded startBlock`)
	// Create build dir if it does not exist
	if (!fs.existsSync(buildDir)) {
		console.log('> Creating build directory')
		fs.mkdirSync(buildDir)
	} else {
		console.log('> Build directory exists')
	}

	// Clone contract repo if it doesnt exist
	process.chdir(buildDir)
	if (!fs.existsSync('./ideamarket')) {
		console.log('> Cloning ideamarket repository')
		if (process.env.IDEAMARKET_CLONE_TOKEN) {
			await executeCmd(
				'git clone https://' + process.env.IDEAMARKET_CLONE_TOKEN + '@' + contractsRepo + ' ideamarket'
			)
		} else {
			await executeCmd('git clone https://' + contractsRepo + ' ideamarket')
		}
	} else {
		console.log('> Ideamarket repository exists')
	}

	// Clean and update repo
	process.chdir('./ideamarket')
	console.log('> Cleaning and updating ideamarket repository')
	await executeCmd(`git fetch origin ${branch}`)
	await executeCmd(`git checkout ${branch}`)
	await executeCmd(`git reset --hard origin/${branch}`)

	if (fs.existsSync('./build/contracts')) {
		console.log('> Cleaning old contract build')
		cleanDirectory('./build/contracts')
	}

	// Install dependencies
	console.log('> Installing dependencies')
	await executeCmd('npm i')

	// Compile contracts
	console.log('> Compiling contracts')
	await executeCmd('npx hardhat compile')

	process.chdir('..')

	// Create abi dir if it does not exist
	if (!fs.existsSync(abiDir)) {
		console.log('> Creating ABI directory')
		fs.mkdirSync(abiDir)
	} else {
		console.log('> Cleaning old ABIs')
		cleanDirectory(abiDir)
	}

	// Extracts ABIs from contract build
	console.log('> Extracting ABIs')
	contracts.forEach((contract) => {
		const rawArtifact = fs.readFileSync(path.join('ideamarket/build/contracts/contracts/', contract.abiPath))
		const jsonArtifact = JSON.parse(rawArtifact)
		const abi = JSON.stringify(jsonArtifact.abi)
		fs.writeFileSync(path.join(abiDir, contract.contractName + '.json'), abi)
	})

	// Extract addresses from deployed-{network}.json
	console.log('> Extracting deployed addresses')
	const rawDeployed = fs.readFileSync('ideamarket/deployed/deployed-' + network.name + '.json')
	const jsonDeployed = JSON.parse(rawDeployed)

	const jsonNetworkConfig = { network: network.realNetworkName }

	for (let i = 0; i < contracts.length; i++) {
		const contract = contracts[i]
		jsonNetworkConfig[contract.contractName] = jsonDeployed[contract.deployedName]
	}

	// Hardcode the startblock values. Does not need to be accurate, just save some sync time
	jsonNetworkConfig['startBlock'] = startBlock > 0 ? startBlock : network.startBlock

	fs.writeFileSync('network-config.json', JSON.stringify(jsonNetworkConfig))

	// Generate subgraph.yaml file
	process.chdir('..')
	console.log('> Generating subgraph.yaml')
	let mustacheCmd = 'mustache'
	if (process.platform === 'win32') {
		mustacheCmd += '.cmd'
	}
	executeCmd(mustacheCmd + ' res/network-config.json subgraph.template.yaml > subgraph.yaml')

	// Generate autogen files
	if (fs.existsSync('generated')) {
		deleteDirectory('generated')
	}

	if (fs.existsSync(path.join(buildDir, 'generated'))) {
		deleteDirectory(path.join(buildDir, 'generated'))
	}

	console.log('> Generating autogen files')
	let graphCmd = 'graph'
	if (process.platform === 'win32') {
		graphCmd += '.cmd'
	}
	executeCmd(graphCmd + ' codegen --output-dir ' + path.normalize(buildDir + '/generated'))
}

function cleanDirectory(dir) {
	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach((file) => {
			const curPath = path.join(dir, file)
			if (fs.lstatSync(curPath).isDirectory()) {
				cleanDirectory(curPath)
			} else {
				fs.unlinkSync(curPath)
			}
		})
	}
}

function deleteDirectory(dir) {
	fs.rmdirSync(dir, { recursive: true })
}

async function executeCmd(cmd) {
	return new Promise((resolve, reject) => {
		exec(cmd, (error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

main()
