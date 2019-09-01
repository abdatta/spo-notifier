import * as request from 'request';
import * as cheerio from 'cheerio';

require('dotenv').config();

const request_csrf = request.defaults({ jar: request.jar() })

const login = (req) => {
    return new Promise((resolve, reject) => {
        console.log('Logging in...');
        req.get({
            url: 'https://placement.iitk.ac.in/'
        }, (error, response, body) => {
            const $ = cheerio.load(body);
            const csrf = $('input[name="csrfmiddlewaretoken"]').attr('value');
            req.post({
                url: 'https://placement.iitk.ac.in/login/',
                form: {
                    csrfmiddlewaretoken: csrf,
                    username: process.env.SPO_USERNAME,
                    password: process.env.SPO_PASSWORD
                }
            }, (error, response, body) => {
                if (error || response.statusCode !== 302) {
                    console.error('Login failed!');
                    reject(error || response.statusCode);
                    return;
                }
                console.log('Login successful.');
                resolve();
            })
        });
    })
}

const dashboard = (req, retries=3) => {
    if (retries === 0) {
        console.log('Retries limit reached.');
        return Promise.reject();
    }
    return new Promise((resolve, reject) => {
        req.get({
            url: 'https://placement.iitk.ac.in/dashboard/'
        }, (error, response, body) => {
            const $ = cheerio.load(body);
            if ($('form[action="/login/"]').html()) {
                console.log('Not logged in.')
                login(req)
                    .then(() => resolve(dashboard(req, retries-1)))
                    .catch(err => reject(err));
                return;
            }
            const news_title = $('.panel-title > div .col-sm-9').text().trim();
            const news_date = $('.panel-title > div .col-sm-3').text().trim();
            const news_body = $('.panel-body').html().trim();
            console.log('Title:', news_title);
            console.log('Date:', news_date);
            console.log(news_body);
        });
    })
}

dashboard(request_csrf);
