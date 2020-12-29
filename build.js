/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const fs = require('fs')
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const { exec } = require('child_process')
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const path = require('path')

const buildDir = './res'
const abiDir = './abis'
const contractsRepo = 'github.com/ideamarket/ideamarket-contracts.git'

const contracts = [
	['IdeaToken', 'core'],
	['IdeaTokenFactory', 'core'],
	['IdeaTokenExchange', 'core'],
	['IdeaTokenVault', 'core'],
]

async function main() {
	let network = ''

	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === '--rinkeby') {
			network = 'rinkeby'
			break
		} else if (process.argv[i] === '--test') {
			network = 'test'
			break
		} else if (process.argv[i] === '--mainnet') {
			network = 'mainnet'
			break
		}
	}

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
	await executeCmd('git fetch origin master')
	await executeCmd('git reset --hard origin/master')

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
		const file = contract[0] + '.json'
		const curPath = path.join('ideamarket/build/contracts/contracts/', contract[1], contract[0] + '.sol', file)
		if (!curPath.endsWith('.json')) {
			console.log('>     ignoring file ' + curPath)
			return
		}

		const rawArtifact = fs.readFileSync(curPath)
		const jsonArtifact = JSON.parse(rawArtifact)
		const abi = JSON.stringify(jsonArtifact.abi)
		fs.writeFileSync(path.join(abiDir, file), abi)
	})

	// Extract addresses from deployed-{network}.json
	console.log('> Extracting deployed addresses')
	const rawDeployed = fs.readFileSync('ideamarket/deployed/deployed-' + network + '.json')
	const jsonDeployed = JSON.parse(rawDeployed)
	const jsonNetworkConfig = { network: network === 'test' ? 'rinkeby' : network }
	for (let i = 0; i < contracts.length; i++) {
		const contract = contracts[i][0].charAt(0).toLowerCase() + contracts[i][0].slice(1)
		const addr = jsonDeployed[contract]
		jsonNetworkConfig[contract] = addr
	}

	// Hardcode the startblock values. Does not need to be accurate, just save some sync time
	if (network === 'rinkeby') {
		jsonNetworkConfig['startBlock'] = 7590000
	} else if (network === 'test') {
		jsonNetworkConfig['startBlock'] = 7800000
	} else if (network === 'mainnet') {
		jsonNetworkConfig['startBlock'] = 11000000
	}

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
