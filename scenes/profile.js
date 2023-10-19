const fs = require('fs');

const Scene = require('telegraf/scenes/base');

const middlewares = require('../scripts/middlewares');
const messages = require('../scripts/messages');

const {
    userService,
    taskService,
    paymentService
} = require('../services/db');
const { dribbbleService } = require('../services/dribbble');
const { balanceService } = require('../services/balance');

const DRIBBBLE_URL = process.env.DRIBBBLE_URL;

const DRIBBBLE_URL_REG = /((https|http)(:\/\/dribbble.com\/)|(\/))/g;
const TX_HASH_REG = /(0x[0-9a-fA-F]{64})|([0-9A-Fa-f]{64})/;
const ETH_TX_REG = /(0x[0-9a-fA-F]{64})/;
const USDT_TX_REG = /([0-9A-Fa-f]{64})/;

function addUsername() {
    const username = new Scene('username');

    username.use(middlewares.start);
    username.use(middlewares.commands);

    username.enter(async (ctx) => {
        ctx.scene.state.data = {};

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
            extra: (check.success) ?
                (messages.menu(ctx.state.user.locale)).extra : {}
        };

        await ctx.replyWithHTML(message.text, message.extra);

        if (check.success) {
            await userService.update({ tg_id: ctx.from.id }, {
                dribbble_username: username
            });

            await ctx.scene.leave();
        }
    });

    return username;
}

function addNewTask() {
    const task = new Scene('task');

    task.use(middlewares.start);
    task.use(middlewares.commands);

    task.enter(async (ctx) => {
        const now = new Date();

        ctx.scene.state.data = {
            tg_id: ctx.from.id,
            dribbble_username: ctx.state.user.dribbble_username,
            type: null,
            creation_date: now,
            isActive: true,
            data: null,
            all: 0,
            completed: 0,
            price: 0
        };

        await ctx.replyWithHTML(ctx.i18n.t('chooseType_message'), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: ctx.i18n.t('like_button'), callback_data: 'type-like' }],
                    [{ text: ctx.i18n.t('comment_button'), callback_data: 'type-comment' }],
                    [{ text: ctx.i18n.t('following_button'), callback_data: 'type-following' }],
                    [{ text: ctx.i18n.t('cancel_button'), callback_data: 'cancel' }]
                ]
            }
        });
    });

    task.action(/type-([like|comment|following]+)/, async (ctx) => {
        const type = ctx.match[1];

        ctx.scene.state.data.type = type;

        await ctx.deleteMessage();
        await ctx.replyWithHTML(ctx.i18n.t('enterUrl_message'), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: ctx.i18n.t('back_button'), callback_data: 'back' }],
                    [{ text: ctx.i18n.t('cancel_button'), callback_data: 'cancel' }]
                ]
            }
        });
    });
    
    task.action('back', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.reenter();
    });

    task.on('text', async (ctx) => {
        if (ctx.scene.state.data.type) {
            const { data } = ctx.scene.state;
            const text = ctx.message.text;
            const message = {
                type: 'text',
                text: ctx.i18n.t('dataIsntCorrect_message'),
                extra: {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: ctx.i18n.t('back_button'), callback_data: 'back' }],
                            [{ text: ctx.i18n.t('cancel_button'), callback_data: 'cancel' }]
                        ]
                    }
                }
            };

            if (!data.data) {
                let check = {
                    success: false
                };

                let temp = null;

                if (data.type === 'like' || data.type === 'comment') {
                    temp = text.replace(/([\D])/g, '');

                    if (Number(temp)) {
                        check = await dribbbleService.getShot(temp);
                    }
                } else {
                    temp = text.replace(DRIBBBLE_URL_REG, '');

                    check = await dribbbleService.getUser(temp);
                }

                if (check.success) {
                    const CONFIG = JSON.parse(fs.readFileSync('./config.json'));
                    const ACTIONS = {
                        'like': [ctx.i18n.t('like_action'), ctx.i18n.t('likes_action'), 'LIKE_PRICE'],
                        'comment': [ctx.i18n.t('comment_action'), ctx.i18n.t('comments_action'), 'COMMENT_PRICE'],
                        'following': [ctx.i18n.t('follower_action'), ctx.i18n.t('followers_action'), 'FOLLOWING_PRICE']
                    };
                    const price = CONFIG[ACTIONS[data.type][2]];

                    message.text = ctx.i18n.t('enterCount_message', {
                        action: ACTIONS[data.type][0],
                        actions: ACTIONS[data.type][1],
                        price,
                        balance: ctx.state.user.balance
                    });

                    ctx.scene.state.data.data = temp;
                    ctx.scene.state.data.price = price;
                }
            } else if (Number(text)) {
                if (ctx.state.user.balance >= text) {
                    message.text = ctx.i18n.t('taskIsAdded_message');
                    message.extra = {};

                    ctx.scene.state.data.all = Number(text);
                } else {
                    message.text = ctx.i18n.t('notEnoughFound_message');
                }
            }

            await ctx.replyWithHTML(message.text, message.extra);

            if (ctx.scene.state.data.data && ctx.scene.state.data.all) {
                const { user } = ctx.state;
                const { data } = ctx.scene.state;

                await userService.update({ tg_id: ctx.from.id }, {
                    balance: user.balance - data.all,
                    reserved: user.reserved + data.all
                });
                await taskService.create(data);

                await ctx.scene.leave();
            }
        }
    });

    return task;
}

function topUpBalance() {
    const balance = new Scene('balance');

    balance.enter(async (ctx) => {
        ctx.scene.state.data = {
            isSuccessful: false,
            isChecked: false,
            date: new Date(),
            tg_id: ctx.from.id,
            method: null,
            amount: 0,
            value: 0,
            to: null,
            hash: null
        };

        await ctx.replyWithHTML(ctx.i18n.t('choosePaymentMethod_message'), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: ctx.i18n.t('USDT_button'), callback_data: 'method-USDT' }],
                    [{ text: ctx.i18n.t('ETH_button'), callback_data: 'method-ETH' }],
                    [{ text: ctx.i18n.t('cancel_button'), callback_data: 'cancel' }]
                ]
            }
        });
    });

    balance.action(/method-([USDT|ETH]+)/, async (ctx) => {
        const CONFIG = JSON.parse(fs.readFileSync('./config.json'));
        const method = ctx.match[1];

        ctx.scene.state.config = CONFIG;
        ctx.scene.state.data.method = method;

        await ctx.deleteMessage();
        await ctx.replyWithHTML(ctx.i18n.t('enterAmount_message', {
            price: CONFIG.PRICES[method]['1000'],
            method
        }), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: ctx.i18n.t('back_button'), callback_data: 'back' }]
                ]
            }
        });
    });

    balance.action('back', async (ctx) => {
        await ctx.deleteMessage();
        await ctx.scene.reenter();
    });

    balance.hears(TX_HASH_REG, async (ctx) => {
        const {
            method,
            amount,
        } = ctx.scene.state.data;
        const hash = ctx.message.text;
        const message = {
            type: 'text',
            text: ctx.i18n.t('txAccepted_message'),
            extra: {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: ctx.i18n.t('back_button'), callback_data: 'back' }]
                    ]
                }
            }
        };

        let check = null;

        switch(method) {
            case 'ETH':
                check = ETH_TX_REG.test(hash);

                break;
            case 'USDT':
                check = USDT_TX_REG.test(hash);

                break;
        }

        if (check && amount > 0) {
            check = await paymentService.get({ hash });

            if (!check) {
                ctx.scene.state.data.hash = hash;

                const data = await paymentService.create(ctx.scene.state.data);

                balanceService.enqueue(data);

                await ctx.replyWithHTML(message.text, message.extra);

                return await ctx.scene.leave();
            } else {
                message.text = ctx.i18n.t('txAlreadyUse_message');
            }
        } else {
            message.text = ctx.i18n.t('txIsntCorrect_message');
        }

        await ctx.replyWithHTML(message.text, message.extra);
    });

    balance.hears(/([0-9]{4,10})/, async (ctx) => {
        const {
            method
        } = ctx.scene.state.data;
        const message = {
            type: 'text',
            text: '',
            extra: {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: ctx.i18n.t('back_button'), callback_data: 'back' }]
                    ]
                }
            }
        };

        ctx.scene.state.data.amount = parseInt(ctx.message.text);

        if (method) {
            const CONFIG = ctx.scene.state.config;
            const price = (((CONFIG.PRICES[method]['1000']) * ctx.scene.state.data.amount) / 1000).toString();
            const order = ctx.scene.state.data.amount + ' 💰';
            const to = CONFIG[`${method}_WALLET_ADDRESS`];
            const expire = new Date();
            expire.setMonth(expire.getMonth() + 1);

            ctx.scene.state.data.value = price;
            ctx.scene.state.data.to = to;
            ctx.scene.state.data.expire_date = expire;
            ctx.scene.state.data.order = order;
            ctx.scene.state.data.callback = null;

            switch (method) {
                case 'USDT':
                    const data = await paymentService.create(ctx.scene.state.data);

                    balanceService.enqueue(data);

                    return await ctx.scene.leave();
                case 'ETH':
                    message.text = ctx.i18n.t('enterHash_message', {
                        method,
                        price,
                        to
                    });

                    break;
            }

            await ctx.replyWithHTML(message.text, message.extra);
        }
    });

    return balance;
}

module.exports = {
    addUsername,
    addNewTask,
    topUpBalance
}