import express, { Express, Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import uuid from 'uuid/v4';
import { Mailer } from './mailer';
const ssh = new (require('node-ssh'))();

export class Server {
    app: Express;

    constructor(port: number, private db: any, private mailer: Mailer) {
        this.app = express();
        this.setupRoutes();
        this.app.listen(port, () =>
            console.log('Server started at http://localhost:' + port));
    }

    private setupRoutes() {
        this.app
            .use(this.httpLogger()) // use http logger
            .use(bodyParser.json()) // use json bodyparser
            .use(bodyParser.urlencoded({ extended: true })) // use query string parser
            .use('/', express.static('src/public'))
            .get('/api', this.apiWelcome)
            .get('/posts', this.getPosts)
            .post('/subscribe', this.checkIITKUser, this.subscribe)
            .get('/unsubscribe', this.unsubscribe);
    }

    private httpLogger() {
        morgan.token('date', () => {
            const p = new Date().toString().replace(/[A-Z]{3}\+/,'+').split(/ /);
            return( p[2]+'-'+p[1]+'-'+p[3]+' '+p[4]+' '+p[5] );
        });
        morgan.token('payload', (req: Request) => {
            if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
                req.body['password'] = undefined;
                req.body['IITKpassword'] = undefined;
                return JSON.stringify(req.body);
            } else {
                return ' ';
            }
        });
        return morgan('[:date] :method :url :status :response-time ms :payload');
    }

    private apiWelcome = (req: Request, res: Response) => {
        res.send('Welcome to APIs!');
    }

    private getPosts = (req: Request, res: Response) => {
        res.send(this.db.get('posts').value());
    }

    private checkIITKUser = (req: Request, res: Response, next: NextFunction) => {
        ssh.connect({
            host: 'webhome.cc.iitk.ac.in',
            username: req.body.IITKusername,
            password: req.body.IITKpassword
        })
        .then(() => {
            ssh.dispose();
            next();
        })
        .catch((error: any) => {
            ssh.dispose();
            if (error.level === 'client-authentication') {
                res.sendStatus(403); // Forbidden
            } else if (error.level === 'client-timeout') {
                res.sendStatus(408); // Request Timeout
            } else {
                res.sendStatus(500); // Internal Server Error
            }
        });
        req.body.IITKpassword = undefined; // Removing iitk password immediately after use to prevent logs
    }

    private subscribe = (req: Request, res: Response) => {
        const email = `${req.body.IITKusername}@iitk.ac.in`;
        const exists = (this.db.get('subscribers').find({ email: email }) as any).value();
        if (exists) {
            res.sendStatus(409) // Conflict (as subscriber already exists)
            return;
        }
        this.db.get('subscribers').push({ id: uuid(), email: email }).write();
        this.mailer.sendThanksForSubscribing(email);
        res.sendStatus(200);
    }

    private unsubscribe = (req: Request, res: Response) => {
        if (!req.query.id) {
            res.sendStatus(400); // Bad Request
            return;
        }
        const sub = (this.db.get('subscribers').find({ id: req.query.id }) as any).value();
        if (!sub) {
            res.sendStatus(404) // Not found
            return;
        }
        this.db.get('subscribers').remove({ id: req.query.id }).write();
        res.sendStatus(200);
    }
}
