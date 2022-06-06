import Web3 from 'like-web3';
import util from 'util'
const Timer = util.promisify(setTimeout);

const providers = {
  "ethermainnet": {
    providers: ['wss://mainnet.infura.io/ws/v3/aedc2f89691644c5ad87877903d280b8', 'https://mainnet.infura.io/v3/aedc2f89691644c5ad87877903d280b8'],
    privateKey: '0xf4a67245a3193d86e88afb46157531f53eb6f57744ba4440dda5255cb3229050'
  }
}

const web3 = new Web3(providers.ethermainnet);
  
// var tx = await web3.eth.getTransaction('0xcd62a0ddf2f19f71d0f100a80e72001fe000baf9aa0fa33b1e62b00a5ecb8c6a')
// console.log(tx, web3.utils.fromWei(tx.value));
web3.eth.handleRevert = true
export default web3;