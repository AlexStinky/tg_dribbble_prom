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

const stage = new Stage([
    profile.addUsername()
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

bot.catch(err => console.error(err));

bot.hears(/following ([A-Za-z0-9]+) ([A-Za-z0-9]+)/, async (ctx) => {
    const where = ctx.match[1];
    const whom = ctx.match[2];

    const res = await dribbbleService.checkFollowing(where, whom);

    console.log(res)
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));