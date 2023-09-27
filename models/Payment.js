const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
    isSuccessful: Boolean,
    isChecked: Boolean,
    date: Date,
    tg_id: String,
    method: String,
    amount: Number,
    value: String,
    to: String,
    hash: String
}, { versionKey: false });

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = {
    Payment
}