const fs = require('fs');
const axios = require('axios');

const { Web3 } = require('web3');

const TelegrafI18n = require('telegraf-i18n/lib/i18n');

const { userService, paymentService } = require('./db');
const { sender } = require('./sender');

const { Queue } = require('../modules/queue');

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

class Balance extends Queue {
    constructor() {
        super();

        this.CONFIG = JSON.parse(fs.readFileSync('./config.json'));
        this.WEB3_URL = this.CONFIG.MAINNET_URL;
        this.TRONSCAN_URL = process.env.TRONSCAN_URL;
        this.TRANSACTION_HASH = 'transaction-info?hash=';

        this.WHATSAPAY_URL = process.env.WHATSAPAY_URL || 'https://whatsapay.com/'
        this.WHATSAPAY_OPTIONS = {
            headers: {
                'Authorization': this.CONFIG.WHATSAPAY_TOKEN
            }
        };

        this.parser = axios;
        this.web3 = new Web3(this.WEB3_URL);
    }

    changeWallet(currency, wallet) {
        this.CONFIG[`${currency}_WALLET_ADDRESS`] = wallet;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    changePrice(currency, price, amount) {
        this.CONFIG['PRICES'][currency][`${amount}`] = price;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    changeCookies(cookies) {
        this.CONFIG['COOKIES'] = cookies;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    changeWhatsaPay(token) {
        this.CONFIG['WHATSAPAY_TOKEN'] = token;
        this.WHATSAPAY_OPTIONS.headers['Authorization'] = token;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    async run() {
        for (let i = this._oldestIndex; i < this._newestIndex; i++) {
            const data = this._storage[i];

            switch(data.method) {
                case 'USDT':
                    this.usdt(data);

                    break;
                case 'ETH':
                    this.checkPayment(data);
                    
                    break;
            }

            this.dequeue();
        }

        setTimeout(() => this.run(), 1000);
    }

    async usdt(data) {
        const res = await this.getInvoiceUrl(data);
        const message = {
            type: 'text',
            text: '',
            extra: {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: i18n.t('ru', 'topUpBalance_button'), callback_data: 'topUpBalance' }]
                    ]
                }
            }
        };

        message.text = (res.success) ?
            i18n.t('ru', 'invoiceUrlSuccessUSDT_message', {
                order: data.order,
                price: data.value
            }) : i18n.t('ru', 'invoiceUrlFailedUSDT_message');

        if (res.success) {
            message.extra = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: i18n.t('ru', 'pay_button'), url: res.response }],
                        [{ text: i18n.t('ru', 'back_button'), callback_data: 'back' }]
                    ]
                }
            };
        }

        await paymentService.update({ _id: data._id }, {
            isChecked: true
        });

        sender.enqueue({
            chat_id: data.tg_id,
            message
        });
    }

    async checkPayment(data) {
        const res = (data.method === 'ETH') ?
            await this.checkETH(data) : data;
        const message = {
            type: 'text',
            text: i18n.t('ru', 'paymentIsFailed_message'),
            extra: {}
        };

        if (res.success) {
            message.text = i18n.t('ru', 'paymentIsSuccessful_message', {
                balance: data.amount
            });

            await userService.update({ tg_id: data.tg_id }, {
                $inc: {
                    balance: data.amount
                }
            });
        }

        await paymentService.update({ _id: data._id }, {
            isSuccessful: (res.success) ? true : false,
            isChecked: true
        });

        sender.enqueue({
            chat_id: data.tg_id,
            message
        });
    }

    async getInvoiceUrl(body) {
        const { data } = await this.parser.post(this.WHATSAPAY_URL, body, this.WHATSPAY_OPTIONS);

        return {
            success: (data) ? true : false,
            response: data
        };
    }

    async checkETH(data) {
        const res = await this.getTransaction(data.hash);

        if (res.success) {
            const {
                to,
                value
            } = res.data;
            const _value = this.web3.utils.fromWei(value, 'ether');

            if (to.toLowerCase() == data.to.toLowerCase() && _value == data.value) {
                return {
                    success: true,
                    response: res.data
                };
            }
        }

        return {
            success: false,
            response: res.data
        };
    }

    async getTransaction(hash) {
        try {
            const res = await this.web3.eth.getTransaction(hash);

            return {
                success: (res) ? true : false,
                data: res
            };
        } catch (e) {
            console.log(e);

            return {
                success: false,
                data: e
            };
        }
    }

    async checkUSDT(_) {
        const { data } = await this.parser.get(this.TRONSCAN_URL + this.TRANSACTION_HASH + _.hash);

        if (data) {
            const res = await this.tronscan(data, _.to, _.value);

            return res;
        }

        return {
            success: false,
            response: data
        }
    }

    async tronscan(tx, address, value) {
        const transfer = tx['tokenTransferInfo'];

        if (transfer['to_address'] == address && tx.contractRet == 'SUCCESS') {
            //const { data } = await this.parser.get(this.bc_tiker);
            //const amount_usd = (check[0].value * this.bc_coff) * data['USD'].last;

            if (transfer['tokenType'] == 'trc20' &&
                (transfer['amount_str'] / 1000000) >= value) {
                return {
                    success: true,
                    response: transfer
                };
            } else {
                return {
                    success: false,
                    response: transfer
                };
            }
        } else {
            return {
                success: false,
                response: tx
            };
        }
    }
}

const balanceService = new Balance();
balanceService.run();

module.exports = {
    balanceService
}