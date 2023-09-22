const Scene = require('telegraf/scenes/base');

const { userService } = require('../services/db');
const { dribbbleService } = require('../services/dribbble');

const DRIBBBLE_URL = 'https://dribbble.com/';

const DRIBBBLE_URL_REG = /((https|http)(:\/\/dribbble.com\/))/g;

function addUsername() {
    const username = new Scene('username');

    username.enter(async (ctx) => {
        await ctx.replyWithHTML(ctx.i18n.t('enterDribbbleUsername_message'));
    });

    username.on('text', async (ctx) => {
        const username = ctx.message.text.replace(DRIBBBLE_URL_REG, '');
        const url = DRIBBBLE_URL + username;
        const check = await dribbbleService.getUser(username);
        const message = {
            type: 'text',
            text: (check.success) ?
                ctx.i18n.t('accountAdded_message', {
                    url
                }) :
                ctx.i18n.t('accountNotFound_message', {
                    url,
                    username
                }),
            extra: {}
        };

        await ctx.replyWithHTML(message.text);

        if (check.success) {
            await userService.update({ tg_id: ctx.from.id }, {
                dribbble_username: username
            });

            await ctx.scene.leave();
        }
    });

    return username;
}

module.exports = {
    addUsername
}