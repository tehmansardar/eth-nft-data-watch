import mongoose from 'mongoose';

var Schema = mongoose.Schema;

var GlobalState = new Schema({
    last_block_top_minted: Number
});

// Compile model from schema
const model = mongoose.model('GlobalState', GlobalState);

model.find().then(rows => {
    if (rows.length == 0) {
        let state = new model({
            last_block_top_minted: 13570736
        });
        state.save().then(() => {
            console.log("init Global State");
        });
    }
})

export default model;