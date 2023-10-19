const helper = require('./helper');
const messages = require('./messages');

const {
    userService
} = require('../services/db');

const LANGUAGES = /ru/;

const TASKS_LIMIT = 10;

const start = async (ctx, next) => {
    const { message } = ctx.update.callback_query || ctx.update;

    if (message && message.chat.type == 'private') {
        try {
            const username = ctx.chat.username || ctx.from.first_name;
            const locale = 'en'; /*(LANGUAGES.test(ctx.from.language_code)) ?
                ctx.from.language_code : 'ru';*/

            ctx.state.user = await userService.get({ tg_id: ctx.from.id });

            if (!ctx.state.user) {
                const now = new Date();
                const from = (message.text.includes('start ref')) ?
                    message.text.replace('/start ref', '') : 'organic';

                ctx.state.user = await userService.create({
                    tg_id: ctx.from.id,
                    tg_username: username,
                    start_date: now,
                    locale: locale,
                    from: from,
                    isAdmin: false,
                    start_date: now,
                    discount: 0,
                    bonus: 0,
                    dribbble_username: '',
                    balance: 0,
                    reserved: 0
                });
            }

            if (locale !== ctx.state.user.locale ||
                username !== ctx.state.user.tg_username
                ) {
                ctx.state.user.tg_username = username;
                ctx.state.user.locale = locale;

                await userService.update({ tg_id: ctx.from.id }, {
                    tg_username: username,
                    locale: locale
                });
            }

            ctx.i18n.locale(ctx.state.user.locale);

            if (ctx.state.user.dribbble_username.length === 0 && !ctx.scene.state.data) {
                return await ctx.scene.enter('username');
            }
        } catch {
            //...
        }
    }

    return next();
};

const commands = async (ctx, next) => {
    const { message } = ctx.update;
    const {
        user
    } = ctx.state;

    let response_message = null;

    if (message && message.chat.type === 'private' && message.text) {
        const _ = message.text;

        let isScene = false;

        if (_ === '/change') {
            return await ctx.scene.enter('username');
        }

        if (_ === '/balance' || _ === ctx.i18n.t('balance_button')) {
            const {
                balance,
                reserved
            } = ctx.state.user;

            return await ctx.replyWithHTML(ctx.i18n.t('balance_message', {
                balance,
                reserved
            }), {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: ctx.i18n.t('topUpBalance_button'), callback_data: 'topUpBalance' }]
                    ]
                }
            });
        }

        if (_ === '/add' || _ === ctx.i18n.t('add_button')) {
            if (ctx.state.user.balance >= 200) {
                return await ctx.scene.enter('task');
            } else {
                isScene = true;

                await ctx.replyWithHTML(ctx.i18n.t('notEnoughFounds_message', { balance: ctx.state.user.balance }));
            }
        }

        if (_ === '/tasks' || _ === ctx.i18n.t('tasks_button')) {
            ctx.session.tasks_skip = 1;
            ctx.session.tasks = await helper.tasks(ctx, 0, TASKS_LIMIT);

            const index = 0;
            const task = ctx.session.tasks[index];

            response_message = messages.taskMessage(user.locale, task, index, ctx.session.tasks_skip);

            return await ctx.replyWithHTML(response_message.text, response_message.extra);
        }

        if (_ === ctx.i18n.t('topUpBalance_button')) {
            return await ctx.scene.enter('balance');
        }

        if (_ === '/menu' || _ === '/start') {
            const menu_message = messages.menu(ctx.state.user.locale);

            isScene = true;

            await ctx.replyWithHTML(menu_message.text, menu_message.extra);
        }

        if (isScene) {
            return await ctx.scene.leave();
        }
    }

    return next();
};

module.exports = {
    TASKS_LIMIT,
    start,
    commands
}