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

        this.WHATSAPAY_URL = process.env.WHATSAPAY_URL || 'https://api.whatsapay.com/';
        this.WHATSAPAY_NEW_INVOICE = 'db/post_new_invoice';
        this.WHATSAPAY_CALLBACK = 'callback?order_id=';
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

    changeConfig(key, prop) {
        this.CONFIG[key] = prop;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    changeCookies(cookies) {
        this.CONFIG['COOKIES'] = cookies;

        fs.writeFileSync('./config.json', JSON.stringify(this.CONFIG));

        return this.CONFIG;
    }

    changeWhatsaPayToken(token) {
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
                    if (!data.invoice_link) {
                        this.usdt(data);
                    } else {
                        this.checkPayment(data);
                    }

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
        const res = await this.getInvoiceUrl({
            money: Number(data.value),
            payment_system_order_id: data._id,
            purpose_of_payment: [
            {
              product_name: data.order,
              price: data.value
            }],
            expire_at: Date.parse(data.expire_date || new Date()),
            lang: 'ru',
            currency: 'usd'
        });
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
                        [{ text: i18n.t('ru', 'check_button'), callback_data: `cp-${data._id}` }]
                    ]
                }
            };

            await paymentService.update({ _id: data._id }, {
                invoice_link: res.response
            });
        }

        sender.enqueue({
            chat_id: data.tg_id,
            message
        });
    }

    async getInvoiceUrl(body) {
        try {
            const { data } = await this.parser.post(this.WHATSAPAY_URL + this.WHATSAPAY_NEW_INVOICE, body, this.WHATSAPAY_OPTIONS);

            return {
                success: (data) ? true : false,
                response: data
            };
        } catch (e) {
            const res = (e.response) ? e.response.data : e;

            console.log('[getInvoiceUrl]', res);

            return {
                success: false,
                response: res
            };
        }
    }

    async checkPayment(data) {
        const res = (data.callback) ?
            {
                success: (data.callback.status === 'Approved') ? true : false,
                response: data.callback
            } : (data.method === 'ETH') ?
                await this.checkETH(data) : await this.checkUSDT(data);
        const message = {
            type: 'text',
            text: i18n.t('en', 'paymentIsFailed_message'),
            extra: {}
        };

        if (data.callback) {
            if (data.callback.usd_money <= data.callback.money ||
                data.status !== 'Approved') {
                message.text = i18n.t('en', 'paymentWhatsaPayIsFailed_message');
            }
        }

        if (res.success) {
            message.text = i18n.t('en', 'paymentIsSuccessful_message', {
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
            isChecked: true,
            status: (data.callback) ?
                data.callback.status : (res.success) ?
                'Approved' : 'Failed',
            callback: (data.callback) ? data.callback : null
        });

        sender.enqueue({
            chat_id: data.tg_id,
            message
        });
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

    async checkUSDT(_) {
        try {
            const {
                _id
            } = _;
            const { data } = await this.parser.post(this.WHATSAPAY_URL + this.WHATSAPAY_CALLBACK + _id, {}, this.WHATSAPAY_OPTIONS);

            return {
                success: (data) ? true : false,
                response: data
            };
        } catch (e) {
            const res = (e.response) ? e.response.data : e;

            console.log('[checkUSDT]', res);

            return {
                success: false,
                response: res
            };
        }
    }

    async getTransaction(hash) {
        try {
            const res = await this.web3.eth.getTransaction(hash);

            return {
                success: (res) ? true : false,
                data: res
            };
        } catch (e) {
            console.log('[getTransaction]', e);

            return {
                success: false,
                data: e
            };
        }
    }

    /*async checkUSDT(_) {
        const { data } = await this.parser.get(this.TRONSCAN_URL + this.TRANSACTION_HASH + _.hash);

        if (data) {
            const res = await this.tronscan(data, _.to, _.value);

            return res;
        }

        return {
            success: false,
            response: data
        };
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
    }*/
}

const balanceService = new Balance();
balanceService.run();

module.exports = {
    balanceService
}