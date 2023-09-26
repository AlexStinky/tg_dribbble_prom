const fs = require('fs');

const axios = require('axios');
//const puppeteer = require('puppeteer');

const jsdom = require('jsdom');

const { JSDOM } = jsdom;

const { jobService, userService, taskService } = require('./db');

const { Queue } = require('../modules/queue');

const FOLLOWING_REG = /(\/teams\/|\/)/g;

class Dribbble extends Queue {
    constructor() {
        super();

        this.parser = axios;
        this.browser = {};
        this.cookies = '';

        this.URL = process.env.DRIBBBLE_URL;
        this.FOLLOWING = '/following';
        this.LIKES = '/likes';
        this.SHOTS = 'shots/';
        this.COMMENTS = '/comments?page=1&sort=recent&format=json';
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

    async run() {
        const CONFIG = JSON.parse(fs.readFileSync('./config.json'));

        this.cookies = CONFIG.COOKIES;

        for (let i = this._oldestIndex; i < this._newestIndex; i++) {
            const data = this._storage[i];

            await this.job(data);

            this.dequeue();
        }

        setTimeout(() => this.run(), 1000);
    }

    async job(data) {
        const task = await taskService.get({ _id: data.task_id });

        let res = null;

        switch(task.type) {
            case 'like':
                res = await this.checkLike(data.dribbble_username, task.data);

                break;
            case 'comment':
                res = await this.checkComment(data.dribbble_username, task.data);

                break;
            case 'following':
                res = await this.checkFollowing(data.dribbble_username, task.data);

                break;
        }

        if (res.success) {
            if (task && task.isActive) {
                task.completed++;

                if (task.completed >= task.all) {
                    task.isActive = false;
                }

                await taskService.update({ _id: task._id }, task);

                await jobService.update({ task_id: task._id }, {
                    isComplited: true,
                    status: 'success',
                });

                // update balance for executor
                await userService.update({ tg_id: data.tg_id }, {
                    $inc: {
                        balance: task.price
                    }
                });

                // update reserved for customer
                await userService.update({ tg_id: task.tg_id }, {
                    $inc: {
                        reserved: 0 - task.price
                    }
                });

                return {
                    success: true,
                    response: 'OK'
                };
            }
        }

        await jobService.update({ task_id: task._id }, {
            isComplited: true,
            status: 'failed'
        });

        return {
            success: false,
            response: res
        };
    }

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

    async getShot(id) {
        const { data } = await this.parser({
            method: 'get',
            url: this.URL + this.SHOTS + id,
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
                'Cookie': this.cookies
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
                        return temp;
                    }
                }
            });

            return {
                success: (check) ? true : false,
                response: (check) ? (check.getAttribute('href')).replace(FOLLOWING_REG, '') : check
            };
        } else {
            return {
                success: false,
                response: data
            };
        }
    }

    async checkLike(username, id) {
        const { data } = await this.parser({
            method: 'get',
            url: this.URL + username + this.LIKES,
            headers: {
                'Cookie': this.cookies
            }
        });

        if (data) {
            const { document } = new JSDOM(data).window;
            const list = Array.from(document.body.querySelectorAll('div.likes-page-shots > ol > li'));
            const check = list.find((el) => {
                const temp = el.getAttribute('data-thumbnail-id');

                if (temp == id) {
                    return el;
                }
            });

            return {
                success: (check) ? true : false,
                response: (check) ? check.getAttribute('data-thumbnail-id') : check
            };
        } else {
            return {
                success: false,
                response: data
            };
        }
    }

    async checkComment(username, id) {
        const { data } = await this.parser({
            method: 'get',
            url: this.URL + this.SHOTS + id + this.COMMENTS,
            headers: {
                'Cookie': this.cookies
            }
        });

        if (data && data.comments) {
            const { comments } = data;
            const check = comments.find((el) => {
                if (el.user.username == username) {
                    return el;
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
dribbbleService.run();
//dribbbleService.createBrowser();

module.exports = {
    dribbbleService
}