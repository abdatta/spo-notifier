import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
import { DashboardPost } from './interfaces';
// import { UserModel } from '../models/user.model';

const SENDER = `"${ process.env.MAIL_SENDER }" <notifier@${ process.env.MAIL_HOST }>`;
const BCC = process.env.MAIL_BCC || '';
const REPLY_TO = process.env.MAIL_REPLY_TO || BCC || '';

export class MailerConfig {

    public static setup() {
        return new Mailer({
            host: 'smtp.cc.iitk.ac.in',
            port: 465,
            secure: true, // use SSL
            auth: {
                user: process.env.MAIL_AUTH || '',
                pass: process.env.MAIL_PASS || ''
            }
        });
    }

}

export class Mailer {

    private transporter: Transporter;

    constructor(config: MailConfig) {
        // create reusable transporter object using the default SMTP transport
        this.transporter = createTransport(config);
    }

    private sendMail(mailOptions: SendMailOptions): Promise<any> {
        mailOptions.html = this.HEADER + mailOptions.html + this.FOOTER;
        if (!(process.env.MAIL_ENABLED === 'true')) {
            console.log('Mail would have been sent to ' + mailOptions.to);
            console.log('Mail Payoad: ', JSON.stringify(mailOptions, null, 2));
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('Mail sent to ' + mailOptions.to);
                    resolve(info);
                }
            });
        });
    }

    public sendThanksForSubscribing(to: string): Promise<any> {
        const mailOptions: SendMailOptions = {
            to: to,
            from: SENDER,
            bcc: BCC,
            replyTo: REPLY_TO,
            subject: 'Sucessfully subscribed to SPO Notifier!',
            html: `<p>Congrats!</p>` +
                  `<p>You have successfully subscribed to SPO Dashboard Notifications via the SPO Notifier. Now you will receive email notifications each time there's a new post on the SPO dashbord.</p>` +
                  `<p>Best of Luck!</p>`
        };

        return this.sendMail(mailOptions);
    }

    public sendPostDigest(posts: DashboardPost[], to: string, unsubscribe_link: string): Promise<any> {
        const mailOptions: SendMailOptions = {
            to: to,
            from: SENDER,
            bcc: BCC,
            replyTo: REPLY_TO,
            subject: `${posts.length} New Update${posts.length==1?'':'s'} on SPO Dashboard`,
            html:   `There has been <b>${posts.length} new update${posts.length==1?'':'s'}</b> on the <a href="https://placement.iitk.ac.in/dashboard/">SPO Dashboard</a>.` +
                    `<br>` +
                    posts.map((post, i) =>
                        `<div class="new-post">` +
                            `<p><b>${i+1}. <u>${post.title}</u></b><br>&emsp;[Posted On: ${post.date}]</p>` +
                            `<blockquote>${post.body}</blockquote>` +
                        `</div>`
                    ).join(`<br>`) +
                    `<p><small>You received this mail beacause you have subscribed to <a href="https://spoii.tk/">SPO Notifier</a>. To unsubscribe, ` +
                    `<a href="${ unsubscribe_link }">click here</a>.</small></p>`
        };

        return this.sendMail(mailOptions);
    }

    private readonly HEADER = `<html><head>` +
                                `<style>` +
                                    `.new-post {` +
                                        `border-bottom: 1px #c0c0c0 solid;` +
                                    `}` +
                                `</style>` +
                               `</head>` +
                               `<body>`;

    private readonly FOOTER = `------` +
                                `<div style="font: 10px/1.4 Arial,Helvetica,sans-serif;">` +
                                    `<p>Regards,<br>SPO Notifier (by Abhishek Datta)</p>` +
                                    `<p>` +
                                        `Abhishek Datta<br>` +
                                        `Final Year, B.Tech (EE)<br>` +
                                        `<a href="mailto:abdatta@iitk.ac.in">abdatta@iitk.ac.in</a> | 7003801867` +
                                    `</p>` +
                               `</div>` +
                              `</body></html>`;
}

interface MailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}
