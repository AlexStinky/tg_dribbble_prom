const fs = require('fs');

const axios = require('axios');
//const puppeteer = require('puppeteer');

const jsdom = require('jsdom');

const { JSDOM } = jsdom;

const { sender } = require('./sender');
const { jobService, userService, taskService } = require('./db');

const { Queue } = require('../modules/queue');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const FOLLOWING_REG = /(\/teams\/|\/)/g;

class Dribbble extends Queue {
    constructor() {
        super();

        this.parser = axios;
        this.browser = {};
        this.cookies = '';

        this.CONFIG = {};

        this.URL = process.env.DRIBBBLE_URL;
        this.FOLLOWING = '/following';
        this.LIKES = '/likes';
        this.SHOTS = 'shots/';
        this.COMMENTS = '/comments?page=1&sort=recent&format=json';

        this.DELAY = 900000;
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
        this.CONFIG = JSON.parse(fs.readFileSync('./config.json'));

        this.cookies = this.CONFIG.COOKIES;

        for (let i = this._oldestIndex; i < this._newestIndex; i++) {
            const data = this._storage[i];

            await this.job(data);

            this.dequeue();

            if (i % 30 === 0) {
                await sleep(this.DELAY);
            }
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

                await jobService.update({ _id: data.job_id }, {
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
        } else if (res.isError) {
            console.log(res.response);

            sender.enqueue({
                chat_id: this.CONFIG.LOGS_ID,
                message: {
                    type: 'text',
                    text: (res.response) ? JSON.stringify(res.response) : 'Error',
                    extra: {}
                }
            });
        }

        await jobService.update({ _id: data.job_id }, {
            isComplited: true,
            status: 'failed'
        });

        return {
            success: false,
            response: res
        };
    }

    async getUser(username, isTask = false) {
        try {
            const { data } = await this.parser({
                method: 'get',
                url: this.URL + username,
            });
            const { document } = new JSDOM(data).window;
            const avatar = (document.body.querySelector('img.profile-avatar')).getAttribute('src');

            if (avatar) {
                const isDefault = avatar.includes('avatar-default');

                if (!isDefault || isTask) {
                    const shots = Array.from(document.body.querySelectorAll('.shot-thumbnail'));

                    if (shots.length >= 3 || isTask) {
                        return {
                            success: true,
                            response: data
                        };
                    } else {
                        throw 'Not enough shots (min 3)'
                    }
                } else {
                    throw 'Profile avatar is default';
                }
            } else {
                throw 'Account not found';
            }
        } catch (e) {
            return {
                success: false,
                isError: true,
                response: e
            }
        }
    }

    async getShot(id) {
        try {
            const { data } = await this.parser({
                method: 'get',
                url: this.URL + this.SHOTS + id,
            });

            return {
                success: true,
                response: data
            };
        } catch (e) {
            return {
                success: false,
                isError: true,
                response: e
            }
        }
    }

    async checkFollowing(where, whom) {
        try {
            const { data } = await this.parser({
                method: 'get',
                url: this.URL + where + this.FOLLOWING,
                headers: {
                    'Cookie': this.cookies
                }
            });
            const { document } = new JSDOM(data).window;
            const list = Array.from(document.body.querySelectorAll('div.results-pane > ol > li'));

            let check = null;

            for (let i = 0; i < list.length; i++) {
                const temp = list[i].querySelector('.designer-link');

                if (temp) {
                    check = (temp.getAttribute('href')).replace(FOLLOWING_REG, '');

                    if (check == whom) {
                        break;
                    }
                }
            }

            return {
                success: (check) ? true : false,
                response: check
            };
        } catch (e) {
            return {
                success: false,
                isError: true,
                response: e
            };
        }
    }

    async checkLike(username, id) {
        try {
            const { data } = await this.parser({
                method: 'get',
                url: this.URL + username + this.LIKES,
                headers: {
                    'Cookie': this.cookies
                }
            });

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
        } catch (e) {
            return {
                success: false,
                isError: true,
                response: e
            };
        }
    }

    async checkComment(username, id) {
        try {
            const { data } = await this.parser({
                method: 'get',
                url: this.URL + this.SHOTS + id + this.COMMENTS,
                headers: {
                    'Cookie': this.cookies
                }
            });

            let check = null;

            if (data && data.comments) {
                const { comments } = data;
                check = comments.find((el) => {
                    if (el.user.username == username) {
                        return el;
                    }
                });
            }

            return {
                success: (check) ? true : false,
                response: (check) ? check : data
            };
        } catch (e) {
            return {
                success: false,
                isError: true,
                response: e
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