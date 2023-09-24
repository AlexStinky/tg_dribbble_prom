const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const JobSchema = new Schema({
    task_id: String,
    tg_id: String,
    dribbble_username: String,
    date: Date,
    isComplited: Boolean,
    status: String,
    reward: Number
}, { versionKey: false });

const Job = mongoose.model('Job', JobSchema);

module.exports = {
    Job
}