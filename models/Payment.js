const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
    isSuccessful: Boolean,
    isChecked: Boolean,
    date: Date,
    expire_date: Date,
    tg_id: String,
    method: String,
    amount: Number,
    value: String,
    to: String,
    hash: String,
    order: String,
    invoice_link: String | null,
    callback: Object | null
}, { versionKey: false });

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = {
    Payment
}