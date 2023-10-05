const fs = require('fs');
const TelegrafI18n = require('telegraf-i18n/lib/i18n');
const { dribbbleService } = require('../services/dribbble');

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

const DRIBBBLE_URL = process.env.DRIBBBLE_URL;

const pagination = (locale, index, temp, key, tasks_skip) => {
    const keyboard = temp;

    keyboard[keyboard.length] = (index === 0 && tasks_skip <= 1) ?
        [{ text: i18n.t(locale, 'next_button'), callback_data: `next${key}-` + (index + 1) }] :
        [
            { text: i18n.t(locale, 'back_button'), callback_data: `next${key}-` + (index - 1) },
            { text: i18n.t(locale, 'next_button'), callback_data: `next${key}-` + (index + 1) },
        ];

    return keyboard;
};

const menu = (locale) => {
    const message = {
        type: 'text',
        text: i18n.t(locale, 'menu_message'),
        extra: {
            reply_markup: {
                resize_keyboard: true,
                keyboard: [
                    [{ text: i18n.t(locale, 'balance_button') }],
                    [
                        { text: i18n.t(locale, 'add_button') },
                        { text: i18n.t(locale, 'tasks_button') }
                    ],
                    [{ text: i18n.t(locale, 'topUpBalance_button') }]
                ]
            }
        }
    };

    return message;
};

const taskMessage = (locale, task, index, tasks_skip) => {
    const message = {
        type: 'text',
        text: i18n.t(locale, 'tasksOver_message'),
        extra: {}
    };
    let keyboard = [];

    if (task) {
        keyboard[keyboard.length] = [
            { text: i18n.t(locale, 'done_button'), callback_data: 'doneTask-' + (index) + '-' + task._id }
        ];

        switch(task.type) {
            case 'like':
                message.text = i18n.t(locale, 'like_task', {
                    url: DRIBBBLE_URL + dribbbleService.SHOTS + task.data,
                    price: task.price
                });
                break;
            case 'comment':
                message.text = i18n.t(locale, 'comment_task', {
                    url: DRIBBBLE_URL + dribbbleService.SHOTS + task.data,
                    price: task.price
                });
                break;
            case 'following':
                message.text = i18n.t(locale, 'following_task', {
                    url: DRIBBBLE_URL + task.data,
                    price: task.price
                });
                break;
        }

        keyboard = pagination(locale, index, keyboard, 'Task', tasks_skip);
    }

    message.extra = {
        reply_markup: {
            inline_keyboard: keyboard
        }
    };

    return message;
};

module.exports = {
    menu,
    taskMessage
}