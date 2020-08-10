import {Callback, Context, Handler} from 'aws-lambda';

const shell = require('shelljs');

const createResponse = (statusCode: number, body: any) => ({
    statusCode: statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
});

async function cloneRepo() {
    if (process.env.BASE_REPO) {
        const repo = process.env.BASE_REPO;
        const gitPath = repo.slice(repo.lastIndexOf('/') + 1);
        const path = gitPath.slice(0, gitPath.lastIndexOf('.'));

        shell.rm('-rf', path);
        shell.exec(`git clone ${process.env.BASE_REPO}`);

        if (shell.error()) {
            throw new Error(shell.error());
        }
    } else {
        throw new Error("No Repo given for ip blacklist baseline.");
    }
}


export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    try {
        await cloneRepo();
        return createResponse(200, 'ok');
    } catch (e) {
        return createResponse(503, e.message);
    }
};

