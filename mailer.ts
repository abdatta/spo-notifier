import { Transporter, createTransport, SendMailOptions } from 'nodemailer';
// import { UserModel } from '../models/user.model';

const SENDER = `"${ process.env.MAIL_SENDER }" <noreply@${ process.env.MAIL_HOST }>`;
const BCC = process.env.MAIL_BCC || '';

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
        mailOptions.html += this.FOOTER;
        if (!process.env.MAIL_ENABLED) {
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

    // public sendAccountVerficationLink(user: UserModel, IITKuser: string, verifyLink: string, deregisterLink: string): Promise<any> {
    //     const mailOptions: SendMailOptions = {
    //         to: user.email,
    //         from: SENDER,
    //         bcc: BCC,
    //         subject: 'Account Verification Link',
    //         html: `<p>Hi ${ user.name } (${ user.rollno }),</p>` +
    //               `<p>` +
    //                 `Thank you for signing up in the Mess Automation Portal, Hall 3. ` +
    //                 `Please verify your account using the following link:` +
    //               `</p>` +
    //               `<p><a href="${ verifyLink }">${ verifyLink }</a></p>` +
    //               `<p>` +
    //                 `You were signed up by IITK user: ${ IITKuser }.<br>` +
    //                 `If you didn't request for this signup, you can deregister your account using ` +
    //                 `<a href="${ deregisterLink }">this link</a>.` +
    //               `</p>`
    //     };

    //     return this.sendMail(mailOptions);
    // }

    private readonly FOOTER = `------` +
                                `<div style="font: 10px/1.4 Arial,Helvetica,sans-serif;">` +
                                    `<p>In case of any difficulty or concern, please feel free to contact any one of us.</p>` +  
                                    `<p>` +
                                        `Ashish Kumar Singh<br>` +
                                        `Web-Incharge (Present)<br>` +
                                        `Hall 3 IIT Kanpur<br>` +
                                        `<a href="mailto:ashsgh@iitk.ac.in">ashsgh@iitk.ac.in</a> | 8778124118` +
                                    `</p>` +
            
                                    `<p>` +
                                        `Abhishek Datta<br>` +
                                        `Web-Incharge (2017-2018)<br>` +
                                        `Hall 3 IIT Kanpur<br>` +
                                        `<a href="mailto:abdatta@iitk.ac.in">abdatta@iitk.ac.in</a> | 7003801867` +
                                    `</p>` +
                               `</div>`;
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
