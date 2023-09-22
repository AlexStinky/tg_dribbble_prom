const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TaskSchema = new Schema({
    tg_id: String,
    dribbble_username: String,
    type: String,
    creation_date: Date,
    isActive: Boolean,
    all: Number,
    completed: Number
}, { versionKey: false });

const Task = mongoose.model('Task', TaskSchema);

module.exports = {
    Task
}