require('dotenv').config();

import * as fs from 'fs';
import * as request from 'request';
import * as cheerio from 'cheerio';

import { DashboardPost, Subscriber, JobOpening } from './interfaces';
import { MailerConfig } from './mailer';
import { Server } from './server';

const sanitize = require('sanitize-filename');

const adapter = new (require('lowdb/adapters/FileSync'))('db.json');
const db = require('lowdb')(adapter)

const mailer = MailerConfig.setup();

// Setting some defaults (required if the db JSON file is empty)
db.defaults({ posts: [], subscribers: [], jobs: [] })
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

const jaf_list = (req: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>, retries=3): Promise<JobOpening[]> => {
    if (retries === 0) {
        console.log('Retries limit reached.');
        return Promise.reject();
    }
    return new Promise((resolve, reject) => {
        req.get({
            url: 'https://placement.iitk.ac.in/jaf_list/'
        }, (error, response, body) => {
            if (error) {
                resolve(jaf_list(req, retries-1));
                return;
            }
            const $ = cheerio.load(body);
            if ($('form[action="/login/"]').html()) {
                console.log('Not logged in.')
                login(req)
                    .then(() => resolve(jaf_list(req, retries-1)))
                    .catch(err => reject(err));
                return;
            }
            const jobs: JobOpening[] = [];
            $("#Table > tbody > tr").each((i, el) => {
                const job_id = $(el).find('td:nth-child(1) > a').attr('href').split('/')[2];
                const job_profile = $(el).find('td:nth-child(1)').text().trim();
                const job_company = $(el).find('td:nth-child(2)').text().trim();
                jobs.push({
                    id: job_id,
                    profile: job_profile,
                    company: job_company
                })
            });
            resolve(jobs);
        });
    })
}

const bs_cdn = `<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">`;

const proforma = (req: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>, job: JobOpening, retries=3) => {
    if (retries === 0) {
        console.log('Retries limit reached.');
        return Promise.reject();
    }
    return new Promise((resolve, reject) => {
        req.get({
            url: 'https://placement.iitk.ac.in/jaf_view/' + job.id
        }, (error, response, body) => {
            if (error) {
                resolve(proforma(req, job, retries-1));
                return;
            }
            const $ = cheerio.load(body);
            if ($('form[action="/login/"]').html()) {
                console.log('Not logged in.')
                login(req)
                    .then(() => resolve(proforma(req, job, retries-1)))
                    .catch(err => reject(err));
                return;
            }
            const content = $('.card > .content').html();
            if (!content) {
                console.log('No content found for job:', JSON.stringify(job));
                reject('No content found');
                return;
            }
            const fname = sanitize(`${job.company} - ${job.profile} (${job.id}).html`);
            console.log('Saving new job:', fname);
            fs.writeFile('archive/' + fname, bs_cdn + content.trim(), (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            })
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
        // After scraping dashboard
        .then(posts => {
            // Filters new posts that do not exist in db
            const new_posts = posts.filter(post => !(db.get('posts').find(post) as any).value());
            // If new posts are found
            if (new_posts.length > 0) {
                // Add new posts to database
                db.get('posts').push(...new_posts.slice().reverse()).write();
                // Send digest mails on new Posts
                sendPostsDigest(new_posts);
            }
            // Print the final verdict of this dashboard scraping.
            console.log(`Posts Verdict: ${new_posts.length} new post${new_posts.length-1?'s':''} found.`);

            // Scraping job lists for updates
            return jaf_list(request_csrf);
        })
        // After scraping job lists
        .then(jobs => {
            // Filters new jobs that do not exist in db
            const new_jobs = jobs.filter(job => !(db.get('jobs').find(job) as any).value());
            // If new jobs are found
            if (new_jobs.length > 0) {
                // Add new jobs to database
                db.get('jobs').push(...new_jobs.slice().reverse()).write();
            }
            new_jobs.forEach(job => proforma(request_csrf, job).catch(console.log));
            // Print the final verdict of this job list scraping.
            console.log(`Jobs Verdict: ${new_jobs.length} new job${new_jobs.length-1?'s':''} found.\n`);
        })
        .catch(error => console.error('Failed to check for updates!', error));  
}

checkForUpdate();
const interval = parseInt(process.env.CHECK_UPDATE_INTERVAL || '');
if (interval) {
    setInterval(checkForUpdate, interval);
}
