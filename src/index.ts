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

const onUpdatePost = (oldPost: DashboardPost, newPost: DashboardPost) => {
    // Extracting only the text from the body which is in html format
    const oldPostBodyContent = cheerio.load(`<body>${oldPost.body}</body>`)('body').text();
    const newPostBodyContent = cheerio.load(`<body>${newPost.body}</body>`)('body').text();

    // Check if the update was in the html tags only, and content was same
    if (oldPostBodyContent === newPostBodyContent) {
        // No need to send notifs since only html was updated
        console.log('Update detected (with only HTML tags) in: ' + newPost.title);
        console.log('No notification will be sent.');
        return;
    }

    console.log('Update detected in: ' + newPost.title);
    // Detecting the differences with the updated content
    const body_diff = differ.main(oldPostBodyContent, newPostBodyContent);
    differ.cleanupSemantic(body_diff);
    newPost.body = differ.prettyHtml(body_diff); // Marking the detected diferences with html
    newPost.title = '[Update] ' + newPost.title; // Adding 'update' prefix to title

    sendPostNotification(newPost);
};

const onNewPost = (post: DashboardPost) => {
    console.log('New Post Found:', post.title);
    sendPostNotification(post);
};

const sendPostNotification = async (post: DashboardPost)  => {
    const subs: Subscriber[] = db.get('subscribers').value();
    for (const sub of subs) {
        await mailer.sendPostNotification(post, sub.email, `${host}/unsubscribe?id=${encodeURIComponent(sub.id)}`)
                    .catch((error) => console.error('Send mail error:', error));
    }
}

const checkForUpdate = () => {
    console.log(`\nChecking for Updates at [${Date()}]`);
    // Scraping dashboard for updates
    dashboard(request_csrf)
        .then(posts => {
            let new_count = 0; // count of number of new posts
            let update_count = 0; // count of number of updated posts
            // iterate through each post to check for new or updated ones
            posts.reverse().forEach(post => {
                // check if such a post already exists
                const exists = (db.get('posts').find(post) as any).value();
                if (exists) {
                    /* Update existing posts is disabled as it is not found to be much useful, and was causing spam! */
                    // // Check for any changes in the existing post body
                    // if (exists.body !== post.body) {
                    //     // Changes detected, means post has been updated.
                    //     update_count++; // Increase update count.
                    //     // Update post body in database
                    //     const i = db.get('posts').findIndex({ title: post.title, date: post.date });
                    //     db.update(`posts[${i}]`, () => post).write();
                    //     // Trigger onUpdate pipeline
                    //     onUpdatePost(exists, post);
                    // }
                    return;
                }
                // Code reaches here means new post found.
                new_count++; // Increase new post count
                // Add new post in database
                db.get('posts').push(post).write();
                // Trigger onNewPost pipeline
                onNewPost(post);
            });
            // Print the final verdict of this scraping.
            console.log(`Verdict: ${new_count} new post${new_count-1?'s':''} found. ${update_count} old post${update_count-1?'s':''} updated.\n`)
        })
        .catch(error => console.error('Failed to check for updates!', error));
}

checkForUpdate();
const interval = parseInt(process.env.CHECK_UPDATE_INTERVAL || '');
if (interval) {
    setInterval(checkForUpdate, interval);
}
