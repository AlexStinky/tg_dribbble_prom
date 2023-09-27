const fs = require('fs');
const axios = require('axios');

const { Web3 } = require('web3');

const TelegrafI18n = require('telegraf-i18n/lib/i18n');

const { userService, paymentService } = require('./db');
const { sender } = require('./sender');

const { Queue } = require('../modules/Queue');

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

        this.parser = axios;
        this.web3 = new Web3(this.WEB3_URL);
    }

    async run() {
        for (let i = this._oldestIndex; i < this._newestIndex; i++) {
            const data = this._storage[i];

            const res = (data.method === 'ETH') ?
                await this.checkETH(data) : await this.checkUSDT(data);
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

            await paymentService.update({ hash: data.hash }, {
                isSuccessful: (res.success) ? true : false,
                isChecked: true
            });

            sender.enqueue({
                chat_id: data.tg_id,
                message
            });

            this.dequeue();
        }

        setTimeout(() => this.run(), 1000);
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