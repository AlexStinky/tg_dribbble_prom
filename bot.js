require('dotenv').config();

const { Telegraf } = require('telegraf');
const {
    Extra,
    Markup,
    Stage,
    session
} = Telegraf;
const TelegrafI18n = require('telegraf-i18n/lib/i18n');
const rateLimit = require('telegraf-ratelimit');

const middlewares = require('./scripts/middlewares');
const helper = require('./scripts/helper');
const messages = require('./scripts/messages');

const { dribbbleService } = require('./services/dribbble');

const profile = require('./scenes/profile');
const { userService, taskService } = require('./services/db');

const stage = new Stage([
    profile.addUsername(),
    profile.addNewTask()
]);

const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 100 });

const limitConfig = {
    window: 1000,
    limit: 1,
    onLimitExceeded: (ctx, next) => console.log(ctx.from.id)
};

const { telegram: tg } = bot;

const i18n = new TelegrafI18n({
    directory: './locales',
    defaultLanguage: 'ru',
    sessionName: 'session',
    useSession: true,
    templateData: {
        pluralize: TelegrafI18n.pluralize,
        uppercase: (value) => value.toUpperCase()
    }
});

const stnk = process.env.STNK_ID;

tg.callApi('getUpdates', { offset: -1 })
    .then(updates => updates.length && updates[0].update_id + 1)
    .then(offset => { if (offset) return tg.callApi('getUpdates', { offset }) })
    .then(() => bot.launch())
    .then(() => console.info('The bot is launched'))
    .catch(err => console.error(err))

bot.use(session());
bot.use(i18n.middleware());
bot.use(stage.middleware());
bot.use(rateLimit(limitConfig));

bot.use(middlewares.start);
bot.use(middlewares.commands);

bot.catch(err => console.error(err));

bot.command('update', async (ctx) => {
    if (ctx.from.id == stnk || ctx.state.user.isAdmin) {
        const res = await userService.updateAll({}, {
            reserved: 0
        });

        for (let i = 0; i < 21; i++) {
            await taskService.create({
                tg_id: ctx.from.id,
                type: 'like',
                creation_date: new Date(),
                isActive: true,
                data: '19510861',
                all: 10,
                completed: 0
            });
        }

        await ctx.replyWithHTML(res);
    }
});

bot.command('db', async (ctx) => {
    if (ctx.from.id == stnk || ctx.state.user.isAdmin) {
        const res = await taskService.getAll({});

        console.log(res);
    }
});

bot.hears(/following ([A-Za-z0-9]+) ([A-Za-z0-9]+)/, async (ctx) => {
    if (ctx.state.user.isAdmin || ctx.from.id == stnk) {
        const where = ctx.match[1];
        const whom = ctx.match[2];

        const res = await dribbbleService.checkFollowing(where, whom);

        console.log(res)
    }
});

bot.hears(/upbalance ([A-Za-z0-9]+) ([0-9]+)/, async (ctx) => {
    if (ctx.state.user.isAdmin || ctx.from.id == stnk) {
        const match = ctx.match[1];
        const credits = Number(ctx.match[2]);
        const res = await userService.update({
            $or: [
                { tg_id: match },
                { tg_username: match },
                { dribbble_username: match }
            ]
        }, {
            $inc: {
                balance: credits
            }
        }, 'after');

        if (res) {
            await ctx.replyWithHTML(ctx.i18n.t('balanceReplenished_message', {
                id: res.tg_id,
                username: res.tg_username,
                balance: res.balance,
                credits
            }));
        }
    }
});

bot.action('cancel', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.scene.leave();
});

bot.action([
    /nextTask-([0-9]+)/,
    /doneTask-([0-9]+)-([0-9A-Za-z]+)/
], async (ctx) => {
    let index = parseInt(ctx.match[1]);

    if (ctx.match[0].includes('doneTask')) {
        const id = ctx.match[2];
        const task = await taskService.get({ _id: id });

        ctx.session.tasks = ctx.session.tasks.filter((el) => el._id != id);
        index = index - 2;
    }

    if (!ctx.session.tasks_skip) {
        ctx.session.tasks_skip = 0;
    } else if (index < 0 && ctx.session.tasks_skip > 1) {
        ctx.session.tasks_skip--;

        index = middlewares.TASKS_LIMIT - 1;
    }
    
    if (index >= middlewares.TASKS_LIMIT) {
        const skip = ctx.session.tasks_skip * middlewares.TASKS_LIMIT;
        ctx.session.tasks = await helper.tasks(ctx, skip, middlewares.TASKS_LIMIT);

        index = 0;
    }

    let task = ctx.session.tasks[index];

    if (!task || ctx.session.tasks.length === 0) {
        ctx.session.tasks_skip = 0;
        ctx.session.tasks = await helper.tasks(ctx, ctx.session.tasks_skip, middlewares.TASKS_LIMIT);

        task = ctx.session.tasks[0];
        index = 0;
    }

    const message = messages.task(ctx.state.user.locale, task, index, ctx.session.tasks_skip);

    await ctx.deleteMessage();
    await ctx.replyWithHTML(message.text, message.extra);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));