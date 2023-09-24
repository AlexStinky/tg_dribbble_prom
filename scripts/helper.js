const { taskService, jobService } = require('../services/db');

const tasks = async (ctx, skip, limit) => {
    const jobs = (await jobService.getAll({
        status: { $ne: 'failed' },
        $or: [
            { tg_id: ctx.from.id },
            { dribbble_username: ctx.state.user.dribbble_username }
        ]
    })).map(el => el._id);

    ctx.session.tasks_skip++;

    return await taskService.getAll({
        isActive: true,
        _id: { $nin: jobs }
    }, { creation_date: 1 }, skip, limit);
}

module.exports = {
    tasks
}