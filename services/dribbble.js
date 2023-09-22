const axios = require('axios');
//const puppeteer = require('puppeteer');

const jsdom = require('jsdom');

const { JSDOM } = jsdom;

const FOLLOWING_REG = /(\/teams\/|\/)/g;

class Dribbble {
    constructor() {
        this.parser = axios;
        this.browser = {};
        this.cookies = [];

        this.URL = process.env.DRIBBBLE_URL;
        this.FOLLOWING = '/following';
    }

    /*async createBrowser() {
        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
        });

        const page = await this.browser.newPage();

        await page.goto('https://dribbble.com/session/new');

        await page.type('#login', 'Sylviadesigns');
        await page.waitForTimeout(4000);
        await page.type('#password', 'qwerty5012');
        await page.waitForTimeout(4000);

        await page.click('.btn2.btn2--large.btn2--full-width.margin-t-20');

        this.cookies = await page.cookies();
        console.log('Cookie:', this.cookies);

        await this.browser.close();
    }*/

    async getUser(username) {
        const { data } = await this.parser({
            method: 'get',
            url: this.URL + username,
        });

        if (data) {
            return {
                success: true,
                response: data
            };
        } else {
            return {
                success: false,
                response: data
            }
        }
    }

    async checkFollowing(where, whom) {
        const { data } = await this.parser({
            method: 'get',
            url: this.URL + where + this.FOLLOWING,
            headers: {
                'Cookie': '_gid=GA1.2.845482992.1695305507; _gcl_au=1.1.1639660833.1695306414; __stripe_mid=a6e0fa13-d5d6-4880-9a5d-612cbceb71b3721ccc; g_state={"i_p":1695315541511,"i_l":1}; user_session_token=a5d2a366-faf7-4be4-b60e-d0b87c7c0c59; has_logged_in=true; _ga_J8586B7WWL=GS1.2.1695311475.2.1.1695312361.60.0.0; _hjSessionUser_2376661=eyJpZCI6ImYxZjNjODVmLTgzNDktNTg2Zi1hYjQxLTlhNjgyYWJlZTkxNCIsImNyZWF0ZWQiOjE2OTUzMTM0MjczOTEsImV4aXN0aW5nIjpmYWxzZX0=; comments_sidebar_open=true; _ga_6YT60CZQ0P=GS1.1.1695327041.4.0.1695327041.0.0.0; _ga_0ZEY8QS3T8=GS1.1.1695327041.4.0.1695327041.60.0.0; _sp_ses.bdb9=*; __stripe_sid=55094bb1-e41c-4bda-865d-830e971b5bd4afc2ee; amplitudeSessionId=1695327040417; _dribbble_session=dHBiSmVyNG1NMmIvLzUrR0c2bkVTN2lBYVZPWkpqWnU4NXdJUVdkb05BdjhUWHlnWnZUaFJYMnB6OTRBSmtoK2xpYXlDbUtUK0M1MEhFV0tpdlRHYnJiZHRsUy9FQjV1ZzNuNjU3dW9VOHk5MndLOUcybS9qeHFqS1lOVCtGYi9EMzh5OTZtOEVTZExodXM2MTB0eEYrZGErZDZINmNkN2t1dmNhZndwUzFGTUxvWWVUdU1EUEZGa3JyaElqelBQRHhuWFl4SkQvU0ZTd3hJN0xUdk5VeVMzOHlMT3A1TlhPZFcwbDZ5MnRuYz0tLU1SQ0s1OEZXM2d4dkp2QVZkbGtRTUE9PQ%3D%3D--5284824d83f57d16e417ba25f4479beba92f7752; _sp_id.bdb9=b5019748-eb6b-4b6e-98a4-3c41e54ecfee.1695306413.6.1695335691.1695330216.eb1c3f64-d7bf-434a-aec9-f1c331a060b6; amp_2cb22d=rZ7Di-s09j-oHciYZ4NCJ5.NzcxMTUxNw==..1hastitoo.1hasu3dbi.1r.1k.3f; _gat_gtag_UA_24041469_1=1; _ga_EV4S8HEMZG=GS1.1.1695335142.7.1.1695335691.0.0.0; _ga=GA1.1.1568101627.1695305507'
            }
        });

        if (data) {
            const { document } = new JSDOM(data).window;
            const list = Array.from(document.body.querySelectorAll('div.results-pane > ol > li'));
            const check = list.find((el) => {
                const temp = el.querySelector('.designer-link');

                if (temp) {
                    const username = (temp.getAttribute('href')).replace(FOLLOWING_REG, '');

                    if (username == whom) {
                        return el;
                    }
                }
            });

            return {
                success: (check) ? true : false,
                response: check
            };
        } else {
            return {
                success: false,
                response: data
            };
        }
    }
}

const dribbbleService = new Dribbble();
//dribbbleService.createBrowser();

module.exports = {
    dribbbleService
}