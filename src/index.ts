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

export async function cloneRepo(repo: string | undefined) {
    if (repo) {
        const gitPath = repo.slice(repo.lastIndexOf('/') + 1);
        const path = gitPath.slice(0, gitPath.lastIndexOf('.'));

        shell.rm('-rf', path);
        shell.exec(`git clone ${repo}`);

        if (shell.error()) {
            throw new Error(shell.error());
        }
    } else {
        throw new Error("No repo given for ip blacklist baseline");
    }
}

function getLists(list: string | undefined) {
    if (list) {
        const lists = list.split(',');
        console.log('BLOCK LISTS');
        console.log(lists);
    } else {
        throw new Error("No Env var specifying block lists.");
    }
}


export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    try {
        await cloneRepo(process.env.BASE_REPO);
        getLists(process.env.BLOCK_LISTS);

        return createResponse(200, 'ok');
    } catch (e) {
        return createResponse(503, e.message);
    }
};

