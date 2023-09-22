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

const { dribbbleService } = require('./services/dribbble');

const profile = require('./scenes/profile');
const { userService } = require('./services/db');

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

        await ctx.replyWithHTML(res);
    }
});

bot.hears(/following ([A-Za-z0-9]+) ([A-Za-z0-9]+)/, async (ctx) => {
    if (ctx.state.user.isAdmin || ctx.from.id == stnk) {
        const where = ctx.match[1];
        const whom = ctx.match[2];

        const res = await dribbbleService.checkComment(where, whom);

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

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));