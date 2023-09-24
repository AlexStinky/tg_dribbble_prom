const mongoose = require('mongoose');

const { User } = require('../models/User');
const { Task } = require('../models/Task');
const { Job } = require('../models/Job');

const DB_CONN = process.env.DB_CONN;

mongoose.set('strictQuery', false);
mongoose.connect(DB_CONN, {
    useUnifiedTopology: true,
    useNewUrlParser: true
});

class DBMethods {
    constructor (model) {
        this.Model = model;
    }
    async create (data) {
        return await this.Model.create(data);
    };

    async get (req, sort = null) {
        return (sort) ?
            await this.Model.findOne(req).sort(sort) : await this.Model.findOne(req);
    };

    async getAll (req, sort = null, skip = 0, limit = 0) {
        return (sort) ?
            await this.Model.find(req).sort(sort).skip(skip).limit(limit) :
            await this.Model.find(req);
    };

    async update (req, update, returnDoc = 'before') {
        return await this.Model.findOneAndUpdate(req, update, {
            returnDocument: returnDoc
        });
    };

    async updateAll (req, update) {
        return await this.Model.updateMany(req, update);
    };

    async delete (req) {
        return await this.Model.findOneAndDelete(req);
    };

    async deleteAll (req) {
        return await this.Model.deleteMany(req);
    };

    async getCount () {
        return await this.Model.find().count();
    };
}

const userService = new DBMethods(User);
const taskService = new DBMethods(Task);
const jobService = new DBMethods(Job);

module.exports = {
    userService,
    taskService,
    jobService
}