import axios from 'axios'
import util from 'util'
import { API_URL, zero_address, apikey, opensea_api, topic0_transfer } from '../consts.js'
import { wait_api_call_limit } from './TransactionController.js'
import web3 from './Web3Controller.js'
import _ from 'lodash'
import abi from '../utils/erc721.abi.js'

const Timer = util.promisify(setTimeout);
const contracts = {
    "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": 0.065
}

let total_calls = 0;
const max_calls = 30;
async function get_wallet_info(address){
    // const sold = await getPastLogs({
    //     fromBlock: 1,
    //     address,
    //     topics: [
    //         topic0_transfer,
    //     ]
    // })
    const totalEth = await getPastLogs({
        topics: [
            topic0_transfer, 
            "0x" + "0".repeat(24) + address
        ], 
        fromBlock: 0, 
        toBlock: 'latest',
        type: 'sell'
    });

    console.log(totalEth);
    // const sold = await web3.eth.getTransactionCount(address);
    // console.log(sold);
}

get_wallet_info('D387A6E4e84a6C86bd90C158C6028A58CC8Ac459');

async function getPastLogs({address, topics, fromBlock, toBlock, type}) {
    const API_KEY = await wait_api_call_limit();
    let params = {
        module: "logs",
        action: "getLogs",
        fromBlock,
        toBlock,
        apikey: API_KEY
    };
    if(type == "sell") 
        Object.assign(params, {
            topic0_1_opr: "and",
            topic0: topics[0],
            topic1: topics[1],
        })
    else
        Object.assign(params, {
            topic0_2_opr: "and",
            topic0: topics[0],
            topic2: topics[1],
        })
    let {data: {result}} = await axios(API_URL, { params })
    console.log(result.length );
    const blockNumber1 = Number(result[0].blockNumber);
    const blockNumber2 = Number(result[result.length - 1].blockNumber);
    console.log(blockNumber1, blockNumber2);
    // if(result.length == 1000)
    //     return await getPastLogs({address, topics, fromBlock: blockNumber2, toBlock, type})
    // const values = await Promise.all([
    //     result.reduce((a, b) => a.indexOf(b.transactionHash) < 0 ? a.concat(b.transactionHash) : a, [])
    //           .map( txHash => web3.eth.getTransaction(txHash) )
    // ])
    const hashes = result.reduce((a, b) => 
        (b.blockNumber != blockNumber2 && a.indexOf(b.transactionHash) < 0) ? a.concat(b.transactionHash) : a, []);
    // const txs = await Promise.all(
    //     hashes.map( tx => web3.eth.getTransaction(tx) )
    // );
    // const values = txs.map(tx => Number(web3.utils.fromWei(tx.value)))
    // const sum = values.reduce((a,b) => a+b, 0);
    // console.log(
    //     sum
    // );
    console.log(result);
    const sum = result.length;
    if( result.length == 1000 && blockNumber1 < blockNumber2)
        return sum + await getPastLogs({address, topics, fromBlock: blockNumber2, toBlock, type})
    return sum;
}