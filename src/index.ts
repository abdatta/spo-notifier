require('dotenv').config();

import * as request from 'request';
import * as cheerio from 'cheerio';

import { DashboardPost, Subscriber } from './interfaces';
import { MailerConfig } from './mailer';
import { Server } from './server';

const differ = new (require('text-diff'))();

const adapter = new (require('lowdb/adapters/FileSync'))('db.json');
const db = require('lowdb')(adapter)

const mailer = MailerConfig.setup();

// Setting some defaults (required if the db JSON file is empty)
db.defaults({ posts: [], subscribers: [] })
  .write();

const port = parseInt(process.env.SERVER_PORT!) || 3000;
const host = process.env.SERVER_HOST || (`http://localhost:${port}`);
const server = new Server(port, db, mailer);

// Setting persistent session as default to prevent multiple logins
const request_csrf = request.defaults({ jar: request.jar() })

const login = (req: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>): Promise<void> => {
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

const dashboard = (req: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>, retries=3): Promise<DashboardPost[]> => {
    if (retries === 0) {
        console.log('Retries limit reached.');
        return Promise.reject();
    }
    return new Promise((resolve, reject) => {
        req.get({
            url: 'https://placement.iitk.ac.in/dashboard/'
        }, (error, response, body) => {
            if (error) {
                resolve(dashboard(req, retries-1));
                return;
            }
            const $ = cheerio.load(body);
            if ($('form[action="/login/"]').html()) {
                console.log('Not logged in.')
                login(req)
                    .then(() => resolve(dashboard(req, retries-1)))
                    .catch(err => reject(err));
                return;
            }
            const posts: DashboardPost[] = [];
            $(".panel").each((i, el) => {
                const news_title = $(el).find('.panel-title > div .col-sm-9').text().trim();
                const news_date = $(el).find('.panel-title > div .col-sm-3').text().trim();
                const news_body = ($(el).find('.panel-body').html() || '').trim();
                posts.push({
                    title: news_title,
                    date: news_date,
                    body: news_body
                });
            });
            resolve(posts);
        });
    })
}

const sendPostsDigest = async (posts: DashboardPost[]) => {
    posts.forEach(post => console.log('New Post Found:', post.title));
    const subs: Subscriber[] = db.get('subscribers').value();
    for (const sub of subs) {
        await mailer.sendPostDigest(posts, sub.email, `${host}/unsubscribe?id=${encodeURIComponent(sub.id)}`)
                    .catch((error) => console.error('Send mail error:', error));
    }
};

const checkForUpdate = () => {
    console.log(`\nChecking for Updates at [${Date()}]`);
    // Scraping dashboard for updates
    dashboard(request_csrf)
        .then(posts => {
            let new_count = 0; // count of number of new posts
            let update_count = 0; // count of number of updated posts
            // Filters new posts that do not exist in db
            const new_posts = posts.filter(post => !(db.get('posts').find(post) as any).value());
            //If new posts are found
            if (new_posts.length > 0) {
                // Add new posts to database
                db.get('posts').push(...new_posts.slice().reverse()).write();
                // Send digest mails on new Posts
                sendPostsDigest(new_posts);
            }
            // Print the final verdict of this scraping.
            console.log(`Verdict: ${new_posts.length} new post${new_count-1?'s':''} found.\n`);
        })
        .catch(error => console.error('Failed to check for updates!', error));
}

checkForUpdate();
const interval = parseInt(process.env.CHECK_UPDATE_INTERVAL || '');
if (interval) {
    setInterval(checkForUpdate, interval);
}
