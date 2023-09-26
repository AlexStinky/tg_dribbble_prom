const { taskService, jobService } = require('../services/db');

const tasks = async (ctx, skip, limit) => {
    const jobs = (await jobService.getAll({
        tg_id: ctx.from.id
    })).map(el => el.task_id);

    const data = await taskService.getAll({
        _id: { $nin: jobs },
        tg_id: { $ne: ctx.from.id },
        data: { $ne: ctx.state.user.dribbble_username },
        isActive: true,
    }, { creation_date: 1 }, skip, limit);

    if (data.length === 0 && skip === 0) {
        return [];
    } else if (data.length === 0) {
        return await tasks(ctx, 0, limit);
    } else {
        return data;
    }
}

module.exports = {
    tasks
}