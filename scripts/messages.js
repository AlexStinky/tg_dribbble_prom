const fs = require('fs');
const TelegrafI18n = require('telegraf-i18n/lib/i18n');

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

    keyboard[keyboard.length] = (index === 0 && tasks_skip === 1) ?
        [{ text: i18n.t(locale, 'next_button'), callback_data: `next${key}-` + (index + 1) }] :
        [
            { text: i18n.t(locale, 'back_button'), callback_data: `next${key}-` + (index - 1) },
            { text: i18n.t(locale, 'next_button'), callback_data: `next${key}-` + (index + 1) },
        ];

    return keyboard;
};

const task = (locale, task, index, tasks_skip) => {
    const message = {
        type: 'text',
        text: i18n.t(locale, 'tasksOver_message'),
        extra: {}
    };
    let keyboard = [];

    if (task) {
        const CONFIG = JSON.parse(fs.readFileSync('./config.json'));

        keyboard[keyboard.length] = [
            { text: i18n.t(locale, 'done_button'), callback_data: 'doneTask-' + (index + 1) + '-' + task._id }
        ];

        switch(task.type) {
            case 'like':
                message.text = i18n.t(locale, 'like_task', {
                    url: DRIBBBLE_URL + task.data,
                    price: CONFIG.LIKE_PRICE
                });
                break;
            case 'comment':
                message.text = i18n.t(locale, 'comment_task', {
                    url: DRIBBBLE_URL + task.data,
                    price: CONFIG.COMMENT_PRICE
                });
                break;
            case 'following':
                message.text = i18n.t(locale, 'following_task', {
                    url: DRIBBBLE_URL + task.data,
                    price: CONFIG.SUBSCRIBE_PRICE
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
    task
}