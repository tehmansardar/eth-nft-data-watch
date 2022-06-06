import axios from 'axios';
import util from 'util';
import {
  API_URL,
  zero_address,
  apikey,
  opensea_api,
  topic0_transfer,
} from '../consts.js';
import { wait_api_call_limit } from './TransactionController.js';
import web3 from './Web3Controller.js';
import _ from 'lodash';
import abi from '../utils/erc721.abi.js';
import Web3 from 'like-web3';

const Timer = util.promisify(setTimeout);

const cache = {};

export const fetch_current_block_number = async () => {
  const {
    data: { result: block_number_hex },
  } = await axios.get(API_URL, {
    params: {
      module: 'proxy',
      action: 'eth_blockNumber',
      apikey: apikey,
    },
  });
  return Number(block_number_hex);
};

async function generateBunchRequest(
  address,
  group_from,
  group_to,
  groups_per_request
) {
  const params = {
    module: 'account',
    action: 'tokennfttx',
    address: address,
    // startblock: 0,
    // endblock: 999999999,
    sort: 'desc',
    // apikey: API_KEY2
  };

  const requests = [];

  for (let i = group_to; i > group_from; i -= groups_per_request) {
    const apikey = await wait_api_call_limit();
    // console.log(apikey);
    requests.push(
      axios.get(API_URL, {
        params: {
          ...params,
          startblock: i - groups_per_request + 1,
          endblock: i,
          apikey,
        },
      })
    );
  }
  return requests;
}

const blacklist = [
  '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85',
  '0xc36442b4a4522e871399cd717abdd847ab11fe88',
];

export const fetch_top_minted = async (
  hour = 24,
  limit = 20,
  cached = true
) => {
  // && (cache[hour][limit].timeStamp > (new Date).getTime()/1000 - 60 * 5)
  if (cached)
    if (cache[hour]) {
      let cachedValue = cache[hour][limit].value;
      let cachedValueSort = cachedValue.sort((a, b) =>
        a.total_minted > b.total_minted ? -1 : 1
      );
      return cachedValueSort;
      // return cache[hour][limit].value;
    } else return [];

  const current_block_number = await fetch_current_block_number();
  console.log({ current_block_number });
  // const last_block_top_minted = globalState.last_block_top_minted;

  let hours = [0.25, 0.5, 1, 6, 12, 24];

  const last_block_top_minted = current_block_number - 100000;
  const timeStamp_start = new Date().getTime() / 1000;
  const timeStamp = timeStamp_start - hour * 3600;
  const timeStamps = hours.map((hour) => timeStamp_start - hour * 3600);

  let minted_all = [];

  for (
    let block_number = current_block_number;
    block_number > last_block_top_minted;
    block_number -= 1100
  ) {
    const responses = await Promise.all(
      await generateBunchRequest(
        zero_address,
        block_number - 1100,
        block_number,
        100
      )
    );
    console.log(
      responses.map((resp) =>
        resp.data.result.length == 22
          ? resp.data.result
          : resp.data.result.length
      )
    );
    minted_all = minted_all.concat(
      ...responses.map((resp) => resp.data.result)
    );
    const last_response = responses[responses.length - 1].data.result;
    if (last_response.length) {
      const lastTimeStamp = Number(
        last_response[last_response.length - 1].timeStamp
      );
      console.log(new Date(lastTimeStamp * 1000));
      if (lastTimeStamp < timeStamp) {
        break;
      }
    }
  }
  // console.log(minted_all);
  let tokens_hours = timeStamps.map((timeStamp) =>
    minted_all.reduce((a, b) => {
      if (Number(b.timeStamp) < timeStamp || b.from != zero_address) return a;
      if (blacklist.indexOf(b.contractAddress) >= 0) return a;
      const token = a.find((each) => each.contractAddress == b.contractAddress);
      if (!token)
        return a.concat({
          tokenName: b.tokenName,
          contractAddress: b.contractAddress,
          count: 1,
        });
      token.count++;
      return a;
    }, [])
  );

  tokens_hours.forEach((tokens) => tokens.sort((a, b) => b.count - a.count));

  let tokens_24 = tokens_hours[tokens_hours.length - 1];

  if (limit)
    tokens_hours = tokens_hours.map((tokens) => tokens.slice(0, limit));

  tokens_24 = tokens_hours.reduce((a, b) => {
    for (let each of b) {
      if (a.findIndex((v) => v.contractAddress == each.contractAddress) < 0)
        a.push(each);
    }
    return a;
  }, []);
  for (let token of tokens_24) {
    try {
      Web3.addContract({
        [token.contractAddress]: {
          abi,
          address: token.contractAddress,
        },
      });
      console.log(token.contractAddress);
    } catch (e) {}
  }
  console.log('total supplies');

  let total_supplies = await Promise.all(
    tokens_24.map((token) => {
      return new Promise((resolve, reject) => {
        getPastLogs({
          fromBlock: 1,
          address: token.contractAddress,
          topics: [topic0_transfer, zero_address + '0'.repeat(24)],
        })
          .then((results) => {
            resolve({
              //  first_minted: results && results[0]?.transactionHash,
              total_minted: results?.length,
              unique_minters: results?.reduce(
                (a, b, i) =>
                  results.find(
                    (each, ind) => ind > i && each?.topics[2] == b?.topics[2]
                  )
                    ? a
                    : a + 1,
                0
              ),
            });
          })
          .catch((e) => {
            console.error(e);
            resolve(0);
          });
      });
    })
  );
  console.log('total supplies complete');

  tokens_24 = tokens_24.map((token, index) => ({
    ...token,
    ...total_supplies[index],
  }));
  tokens_hours = tokens_hours.map((each) =>
    each.map((token) => ({
      ...token,
      ...total_supplies[
        tokens_24.findIndex(
          (token_24) => token_24.contractAddress == token.contractAddress
        )
      ],
    }))
  );

  hours.forEach((hour, index) => {
    if (!cache[hour]) cache[hour] = {};
    cache[hour][limit] = {
      timeStamp: timeStamp_start,
      value: tokens_hours[index],
    };
  });
  console.log(new Date().getTime() / 1000 - timeStamp_start, 's elapsed');

  //   console.log(cache[24][20]);
  let ss = cache[24][20];
  let sss = ss.value.sort((a, b) => (a.total_minted > b.total_minted ? -1 : 1));
  console.log(sss);
  //   return tx_results;
};

let total_calls = 0;
const max_calls = 30;

async function getPastLogs_api({ address, topics, fromBlock, toBlock }) {
  const API_KEY = await wait_api_call_limit();
  let params = {
    module: 'logs',
    action: 'getLogs',
    address,
    topic0_1_opr: 'and',
    topic0: topics[0],
    topic1: topics[1],
    startblock: fromBlock,
    endblock: toBlock,
    apikey: API_KEY,
  };
  let { data } = await axios(API_URL, { params }).catch((err) => {
    throw err;
  });
  console.log(data.length);
}

async function getPastLogs({ address, topics, fromBlock, toBlock, depth }) {
  await Timer(1);
  while (max_calls <= total_calls) {
    await Timer(10);
  }
  total_calls++;
  console.log(total_calls);
  let ret;
  if (!toBlock || fromBlock <= toBlock) {
    try {
      ret = await web3.eth.getPastLogs({
        address,
        topics,
        fromBlock,
        toBlock: toBlock ?? 'latest',
      });
      total_calls--;
      return ret;
    } catch (error) {
      total_calls--;
      console.log('pastLogs', address, fromBlock, toBlock, depth);
      if (!toBlock) {
        toBlock = await web3.eth.getBlockNumber();
        const ownershipLogs = await getPastLogs({
          address,
          fromBlock: 1,
          topics: [
            '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
            zero_address + '0'.repeat(24),
          ],
        });
        // console.log(address, ownershipLogs);
        if (ownershipLogs.length) fromBlock = ownershipLogs[0].blockNumber;
        else fromBlock = 0;
      }
      const nextDepth = depth ? depth + 1 : 1;
      const request_cnt = 2;

      const requests = [];
      for (let i = 0; i < request_cnt; i++) {
        const midBlock1 = parseInt(
          fromBlock + ((toBlock - fromBlock) / request_cnt) * i
        );
        const midBlock2 = parseInt(
          fromBlock + ((toBlock - fromBlock) / request_cnt) * (i + 1)
        );
        requests.push(
          getPastLogs({
            depth: nextDepth,
            address,
            topics,
            fromBlock: midBlock1,
            toBlock: midBlock2,
          })
        );
      }

      const responses = await Promise.all(requests);
      // if(!arr2) return arr1;
      // console.log(responses);
      return [].concat(...responses);
      // const resp = await getPastLogs_api({address, fromBlock, toBlock, topics});
      // return resp;
    }
  }
  return [];
}

export const get_nft_collection_info = async (contract_address) => {
  const { data: info } = await axios.get(
    `${opensea_api}/v1/asset_contract/${contract_address}`
  );
  const name = info.collection.name;
  const slug = info.collection.slug;
  const image_url = info.collection.image_url;
  const official = info.external_url;
  const opensea = `https://opensea.io/collection/${slug}`;
  const twitter = `https://twitter.com/${info.collection.twitter_username}`;
  const discord = info.collection.discord_url;
  const etherscan = `https://etherscan.io/address/${contract_address}`;
  return {
    name,
    slug,
    image_url,
    official,
    opensea,
    twitter,
    discord,
    etherscan,
  };
};
// fetch_top_minted(1);

export const get_nft_collection_tx = async (contract_address, hour = 1000) => {
  const current_block_number = 999999999;
  const timeStamp = new Date().getTime() / 1000 - hour * 3600;
  const apikey = await wait_api_call_limit();
  const params = {
    module: 'logs',
    action: 'getLogs',
    address: contract_address,
    startblock: 0,
    endblock: 999999999,
    sort: 'desc',
    topic0:
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    apikey: apikey,
  };
  let token_list = [];
  while (true) {
    let {
      data: { result: results },
    } = await axios.get(API_URL, {
      params: {
        ...params,
        startblock: 0,
        endblock: current_block_number,
        apikey,
      },
    });
    token_list = token_list.concat(results);
    const last_tx = results[results.length - 1];
    if (results.length < 10000 || Number(last_tx.timeStamp) < timeStamp) break;
    const last_block_number_hex = last_tx.blockNumber;
    current_block_number = Number(last_block_number_hex);
    token_list = token_list.filter(
      (each) => each.blockNumber != last_block_number_hex
    );
  }
  token_list = token_list
    .map((each) => ({
      from: '0x' + each.topics[1].substr(26),
      to: '0x' + each.topics[2].substr(26),
      tokenId: Number(each.topics[3]),
      transactionHash: each.transactionHash,
      timeStamp: Number(each.timeStamp) * 1000,
    }))
    .filter((each) => timeStamp <= each.timeStamp);

  let tx_list = token_list.reduce((a, b) => {
    const tx = a.find((each) => each.transactionHash == b.transactionHash);
    if (tx) {
      tx.tokenIds.push(b.tokenId);
      return a;
    }
    return a.concat(_.omit({ ...b, tokenIds: [b.tokenId] }, 'tokenId'));
  }, []);

  const tx_details = await Promise.all(
    tx_list.map((tx) => web3.eth.getTransaction(tx.transactionHash))
  );
  tx_list = tx_details.map((tx, i) => ({
    ...tx_list[i],
    buyer: tx.from,
    interactedWith: tx.to,
    value: web3.utils.fromWei(tx.value),
  }));

  console.log(tx_list);
  return tx_list;
};

// get_nft_collection_tx('0xb87102481d6d61a5e5b3b4315a4071717f340c99');
