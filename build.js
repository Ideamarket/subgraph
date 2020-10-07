const fs = require("fs")
const { exec } = require("child_process")
const path = require('path')

const buildDir = './build'
const abiDir = './abis'

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
        await executeCmd('git clone https://github.com/ideamarket/ideamarket.git ideamarket')
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
    fs.readdirSync('ideamarket/build/contracts').forEach((file) => {
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
}

function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((file) => {
          const curPath = path.join(dir, file)
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
          } else {
            fs.unlinkSync(curPath)
          }
        })
    }
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