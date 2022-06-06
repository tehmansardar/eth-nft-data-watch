import mongoose from 'mongoose';

var Schema = mongoose.Schema;

var TopMint = new Schema({
    txHash: String,
    tokenAddress: String,
    to: String,
    date: Date,
    tokenID: { type: Number, default: -1 }
});

TopMint.index({ txHash: 1 }, { unique: true });
TopMint.index({ tokenAddress: 1 }, { unique: false });

// Compile model from schema
export default mongoose.model('TopMint', TopMint);