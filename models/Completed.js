const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompletedSchema = new Schema({
    task_id: String,
    tg_id: String,
    date: Date,
    reward: Number
}, { versionKey: false });

const Completed = mongoose.model('Completed', CompletedSchema);

module.exports = {
    Completed
}