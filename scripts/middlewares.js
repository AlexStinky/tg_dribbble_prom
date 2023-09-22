const {
    userService
} = require('../services/db');

const LANGUAGES = /ru/;

const start = async (ctx, next) => {
    const { message } = ctx.update;

    if (message && message.chat.type == 'private') {
        try {
            const username = ctx.chat.username || ctx.from.first_name;
            const locale = (LANGUAGES.test(ctx.from.language_code)) ?
                ctx.from.language_code : 'ru';

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
                    balance: 0
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

            if (ctx.state.user.dribbble_username.length === 0) {
                return await ctx.scene.enter('username');
            }
        } catch {
            //...
        }
    }

    return next();
};

module.exports = {
    start
}