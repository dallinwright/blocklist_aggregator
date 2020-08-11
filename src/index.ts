import {APIGatewayProxyResultV2, Callback, Context, Handler} from 'aws-lambda';
import {bulkWriteToES, createIndex, deleteIndex} from "./elasticsearch";

// Javascript style imports, as they do not have typescript typedefs
const fs = require("fs");
const readline = require('readline');
const glob = require("glob")
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')

export function createResponse(statusCode: number, body: any): APIGatewayProxyResultV2 {
    /**
     * Create API Gateway formatted response
     * @function createResponse
     * @public
     * @param  {number} statusCode HTTP Status Code
     * @param {body} JSON Event response body
     * @return {any} API Gateway formatted JSON response
     */
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    }
}

export async function cloneRepo(): Promise<any> {
    if (!process.env.BASE_REPO) {
        throw new Error("No repo given for ip blacklist baseline");
    }

    const repo = process.env.BASE_REPO;
    const gitPath = repo.slice(repo.lastIndexOf('/') + 1);
    const gitDir = gitPath.slice(0, gitPath.lastIndexOf('.'));

    console.log('Cloning repository ' + repo + ' into ' + '/tmp/' + gitDir);

    await git.clone({
        fs,
        http,
        dir: '/tmp/' + gitDir,
        url: repo,
        singleBranch: true,
    })

    console.dir('Git clone completed');
    return gitDir;
}

function getMatchingFiles(list: string | undefined, clonedPath: string): string[] {
    console.log('Beginning to search for matching files');
    let matchingFiles: string[] = [];

    if (list) {
        const fileList = list.split(',');

        for (const file of fileList) {
            const files = glob.sync('/tmp/' + clonedPath + '/' + file);
            matchingFiles = matchingFiles.concat(files);
        }
    }

    console.log('Matching files complete with list');
    console.log(matchingFiles);
    return matchingFiles;
}

async function getAggregateIPS(files: string[]): Promise<Set<string>> {
    console.log('Beginning to aggregate unique set of ips from across files');
    const ipSet: Set<string> = new Set();

    for (const file of files) {
        const rd = readline.createInterface({
            input: fs.createReadStream(file, 'utf8'),
            output: process.stdout,
            terminal: false,
        });

        for await (const line of rd) {
            if (!line.startsWith('#')) {
                ipSet.add(line)
            }
        }
    }

    console.log('Aggregate complete.')
    return ipSet;
}

export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    console.log('Beginning aggregator execution');
    console.log('Event');
    console.log(event);

    try {
        // Build our data structure of IP's based upon the daily repo update
        const clonedPath: string = await cloneRepo();
        const matchingFiles: string[] = getMatchingFiles(process.env.BLOCK_LISTS, clonedPath);
        const aggregateIps: Set<string> = await getAggregateIPS(matchingFiles);

        console.log('IP LIST SIZE: ' + aggregateIps.size);

        // Create today's index
        await createIndex();

        const response = await bulkWriteToES(aggregateIps);

        // If successful (it would error before here) delete the previous days index
        await deleteIndex();

        return createResponse(200, response);
    } catch (e) {
        return createResponse(503, e.message);
    }
};

