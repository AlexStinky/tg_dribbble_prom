const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    tg_id: String,
    tg_username: String,
    start_date: Date,
    locale: String,
    isAdmin: Boolean,
    dribbble_username: String,
    discount: Number,
    bonus: Number,
    balance: Number,
    reserved: Number
}, { versionKey: false });

const User = mongoose.model('User', UserSchema);

module.exports = {
    User
}