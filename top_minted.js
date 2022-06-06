import express from 'express';
import morgan from 'morgan';
import {
  fetch_top_minted,
  get_nft_collection_info,
  get_nft_collection_tx,
} from './controllers/TopMintedController.js';
import util from 'util';

const timer = util.promisify(setTimeout);

const app = express();

void (async function getRealTime() {
  while (true) {
    let hours = [24];
    for (let hour of hours) {
      await fetch_top_minted(hour, 20, false);
    }
    await timer(60000);
  }
})();

// setTimeout(() => {
//     process.exit(0);
// }, 120000)

app.use(morgan('combined'));
app.get('/api/top-minted', async (req, resp) => {
  const hour = req.query.hour;
  const limit = req.query.limit;
  const top_minted = await fetch_top_minted(hour, limit);
  resp.send(top_minted);
});

app.get('/api/nft-collection/:contract_address', async (req, resp) => {
  const contract_address = req.params.contract_address;
  const nft_info = await get_nft_collection_info(contract_address);
  resp.send(nft_info);
});

app.get('/api/nft-tx/:contract_address', async (req, resp) => {
  const contract_address = req.params.contract_address;
  const hour = req.query.hour;
  const tx_list = await get_nft_collection_tx(contract_address, hour);
  resp.send(tx_list);
});

app.listen(80, () => {
  console.log(`app listening at http://localhost:${80}`);
});
