import express, { Express, Request, Response } from 'express';
import morgan from 'morgan';

export class Server {
    app: Express;

    constructor(port: number) {
        this.app = express();
        this.setupRoutes();
        this.app.listen(port, () =>
            console.log('Server started at http://localhost:' + port));
    }

    private setupRoutes() {
        this.app
            .use(this.httpLogger())
            .use('/', express.static('src/public'))
            .get('/api', this.apiWelcome);
    }

    private httpLogger() {
        morgan.token('date', () => {
            const p = new Date().toString().replace(/[A-Z]{3}\+/,'+').split(/ /);
            return( p[2]+'-'+p[1]+'-'+p[3]+' '+p[4]+' '+p[5] );
        });
        return morgan('[:date] :method :url :status :response-time ms');
    }

    private apiWelcome = (req: Request, res: Response) => {
        res.send('Welcome to APIs!');
    }
}