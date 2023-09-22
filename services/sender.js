const { Queue } = require('../modules/queue');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class Sender extends Queue {
    constructor() {
        super();

        this.bot = {};
        this.limit = 0;
    }

    async create(bot) {
        return this.bot = bot;
    }

    async start() {
        for (let i = this._oldestIndex; i < this._newestIndex; i++) {
            const { chat_id, message } = this._storage[i];

            await this.sendMessage(chat_id, message);

            this.dequeue();

            if (i % 30 === 0) {
                await sleep(1500);
            }
        }

        setTimeout(() => this.start(), 1000);
    }

    async deleteMessage(id, message_id) {
        try {
            return await this.bot.telegram.deleteMessage(id, message_id);
        } catch (e) {
            console.log('[Sender]', e.response.description);

            return null;
        }
    }

    async sendMessage(id, message) {
        this.limit += 100;

        await sleep(this.limit);

        try {
            const text = (message.text) ? message.text.substring(0, 4095) : null;
            const extra = {
                caption: text,
                parse_mode: 'HTML',
                ...message.extra
            };

            let res = null;

            switch (message.type) {
                case 'edit_text':
                    res = await this.bot.telegram.editMessageText(id, message.message_id, null, text);
                    break;
                case 'edit_caption':
                    res = await this.bot.telegram.editMessageCaption(id, message.message_id, null, text);
                    break;
                case 'edit_keyboard':
                    res = await this.bot.telegram.editMessageReplyMarkup(id, message.message_id, null, extra.reply_markup);
                    break;
                case 'photo':
                    res = await this.bot.telegram.sendPhoto(id, message.file, extra);
                    break;
                case 'document':
                    res = await this.bot.telegram.sendDocument(id, message.file, extra);
                    break;
                case 'video':
                    res = await this.bot.telegram.sendVideo(id, message.file, extra);
                    break;
                case 'media_group':
                    res = await this.bot.telegram.sendMediaGroup(id, message.file, extra);
                    break;
                case 'invoice':
                    res = await this.bot.telegram.sendInvoice(id, message.invoice);
                    break;
                default:
                    res = await this.bot.telegram.sendMessage(id, text, extra);
                    break;
            }

            if (this.limit > 1000) {
                this.limit = 0;
            }

            return res;
        } catch (e) {
            const {
                error_code,
                parameters
            } = e;

            console.log('[Sender]', e);

            if (error_code === 429) {
                await sleep(Number(parameters.retry_after) * 1000);
            }

            return null;
        }
    }
}

const sender = new Sender();
sender.start();

module.exports = {
    sender
}