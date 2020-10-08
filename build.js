const fs = require("fs")
const { exec, spawn } = require("child_process")
const path = require('path')

const buildDir = './build'
const abiDir = './abis'
const generatedDir = './generated'

const contracts = [
    'IdeaTokenFactory'
]

async function main() {

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
        if(process.env.IDEAMARKET_CLONE_TOKEN) {
            await executeCmd('git clone https://' + process.env.IDEAMARKET_CLONE_TOKEN + '@github.com/ideamarket/ideamarket.git ideamarket')
        } else {
            await executeCmd('git clone https://github.com/ideamarket/ideamarket.git ideamarket')
        }
    } else {
        console.log('> Ideamarket repository exists')
    }

    // Clean and update repo
    process.chdir('./ideamarket')
    console.log('> Cleaning and updating ideamarket repository')
    await executeCmd('git fetch origin master')
    await executeCmd('git reset --hard origin/master')

    if(fs.existsSync('./build/contracts')) {
        console.log('> Cleaning old contract build')
        cleanDirectory('./build/contracts')
    }

    // Install dependencies
    console.log('> Installing dependencies')
    await executeCmd('npm i')

    // Compile contracts
    console.log('> Compiling contracts')
    await executeCmd('truffle compile')

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
        const file = contract + '.json'
        const curPath = path.join('ideamarket/build/contracts', file)
        if(!curPath.endsWith('.json')) {
            console.log('>     ignoring file ' + curPath)
            return
        }
        
        const rawArtifact = fs.readFileSync(curPath)
        const jsonArtifact = JSON.parse(rawArtifact)
        const abi = JSON.stringify(jsonArtifact.abi)
        fs.writeFileSync(path.join(abiDir, file), abi)
    })

    // Generate autogen files
    console.log('> Generating autogen files')

    if (!fs.existsSync(generatedDir)) {
        console.log('> Creating generated directory')
        fs.mkdirSync(generatedDir)
    } else {
        console.log('> Cleaning old autogen files')
        cleanDirectory(generatedDir)
    }

    const promises = []
    for(let i = 0; i < contracts.length; i++) {
        const contract = contracts[i]
        promises.push(new Promise(async (resolve, reject) => {
            const dir = 'autogen_' + contract

            if(fs.existsSync(dir)) {
                deleteDirectory(dir)
            }

            const abiPath = path.normalize('./abis/'+ contract + '.json')

            let graphCmd = 'graph'
            if(process.platform === "win32") {
                graphCmd += '.cmd'
            }
            const child = spawn(graphCmd, ['init', '--from-contract', '0x0000000000000000000000000000000000000000', '--network', 'mainnet', '--abi', abiPath, dir + '/' + dir])
            child.stdin.setEncoding('utf-8')
            //child.stdout.pipe(process.stdout)
            child.stdin.write('\n') // Name
            await sleep(1500)
            child.stdin.write('\n') // Directory
            await sleep(1500)
            child.stdin.write('\n') // Network
            await sleep(1500)
            child.stdin.write('0x0000000000000000000000000000000000000000\n') // Address
            await sleep(1500)
            child.stdin.write('\n') // ABI file path
            child.stdin.end()
            
            child.on('exit', () => {
                fs.copyFileSync(path.join(dir, 'generated/Contract/Contract.ts'), 'generated/autogen_' + contract + '.ts')
                console.log('> Done: ' + contract)
                resolve()
            })
        }))
    }

    await Promise.all(promises)
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    })
}   

function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((file) => {
            const curPath = path.join(dir, file)
            if (fs.lstatSync(curPath).isDirectory()) {
                cleanDirectory(curPath);
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
        exec(cmd, error => {
            if (error) {
                reject(error)
            } else {
                resolve()
            }
        })
    })
}

main()