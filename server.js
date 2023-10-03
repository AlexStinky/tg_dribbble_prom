require('dotenv').config();

const express = require('express'),
    app = express();

const cors = require('cors');

const TelegrafI18n = require('telegraf-i18n/lib/i18n');

const { balanceService } = require('./services/balance');

const i18n = new TelegrafI18n({
    directory: './locales',
    defaultLanguage: 'uk',
    sessionName: 'session',
    useSession: true,
    templateData: {
        pluralize: TelegrafI18n.pluralize,
        uppercase: (value) => value.toUpperCase()
    }
});

<<<<<<< HEAD
app.set('port', process.env.PORT || 3000);
=======
app.set('port', process.env.PORT);
>>>>>>> 0bfa5e3c175d5126b1e7b88c4b0493774b8823d1

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/payments', async (req, res) => {
    try {
        const data = req.body;

        if (data) {
<<<<<<< HEAD
            console.log(data)
=======
            balanceService.checkPayment(data);
>>>>>>> 0bfa5e3c175d5126b1e7b88c4b0493774b8823d1
        }

        res.send('OK').status(200);
    } catch (e) {
        res.status(500);
    }
});

const port = app.get('port');

app.listen(port, () =>
    console.log(`Server started on port ${port}`)
);

module.exports = {
    app
}