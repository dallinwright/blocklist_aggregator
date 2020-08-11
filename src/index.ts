import {APIGatewayProxyResultV2, Callback, Context, Handler} from 'aws-lambda';

// Javascript style imports, as they do not have typescript typedefs
const fs = require("fs");
const readline = require('readline');
const glob = require("glob")
const path = require('path')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const AWS = require('aws-sdk');
const {Client} = require('@elastic/elasticsearch');
const accessKeyId = AWS.config.credentials.accessKeyId;
const secretAccessKey = AWS.config.credentials.secretAccessKey;

const client = new Client({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    service: 'es',
    region: process.env.ES_REGION,
    node: process.env.ES_ENDPOINT
});

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

export async function cloneRepo(repo: string | undefined): Promise<any> {
    if (repo) {
        console.log('Cloning repository ' + repo);
        const gitPath = repo.slice(repo.lastIndexOf('/') + 1);
        const gitDir = gitPath.slice(0, gitPath.lastIndexOf('.'));

        await git.clone({
            fs,
            http,
            dir: '/tmp/' + gitDir,
            url: repo,
            singleBranch: true,
        })

        console.dir('Git clone completed');
        return gitDir;
    } else {
        throw new Error("No repo given for ip blacklist baseline");
    }
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

// async function writeToES(index: string | undefined, ips: Set<string>) {
//     if (index) {
//         console.log('Begging ES bulk write');
//         const ipArr: string[] = [...ips];
//         const chunkSize = 25;
//
//         for (let i = 0; i < 25; i += chunkSize) {
//             // for (let i = 0; i < ipArr.length; i += chunkSize) {
//             const chunk = ipArr.slice(i, i + chunkSize);
//             const esItems: ESEntry[] = [];
//
//             for (const ip of chunk) {
//                 const body: ESEntry = {
//                     "ip": ip
//                 }
//
//                 esItems.push(body);
//             }
//
//             const body = esItems.flatMap((doc: any) => [{index: {_index: process.env.ES_INDEX}}, doc]);
//
//             const {body: bulkResponse} = await client.bulk({refresh: true, body})
//
//             if (bulkResponse.errors) {
//                 const erroredDocuments: ESError[] = []
//                 // The items array has the same order of the dataset we just indexed.
//                 // The presence of the `error` key indicates that the operation
//                 // that we did for the document has failed.
//                 bulkResponse.items.forEach((action: {
//                     [x: string]: {
//                         status: any;
//                         error: any;
//                     };
//                 }, i: number) => {
//                     const operation = Object.keys(action)[0]
//                     if (action[operation].error) {
//                         erroredDocuments.push({
//                             // If the status is 429 it means that you can retry the document,
//                             // otherwise it's very likely a mapping error, and you should
//                             // fix the document before to try it again.
//                             status: action[operation].status,
//                             error: action[operation].error,
//                             operation: body[i * 2],
//                             document: body[i * 2 + 1]
//                         })
//                     }
//                 })
//                 console.log(erroredDocuments);
//             }
//
//             console.log('Successfully wrote batch ' + i + ' through ' + (i + chunkSize));
//         }
//
//         return 'success';
//     } else {
//         throw new Error("No table name provided");
//     }
// }

export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    console.log('Beginning aggregator execution');
    console.log('Event');
    console.log(event);

    try {
        // Build our data structure of IP's based upon the daily repo update
        const clonedPath: string = await cloneRepo(process.env.BASE_REPO);
        const matchingFiles: string[] = getMatchingFiles(process.env.BLOCK_LISTS, clonedPath);
        const aggregateIps: Set<string> = await getAggregateIPS(matchingFiles);

        // Test and establish Elasticsearch connection
        const clusterInfo = await client.info();
        console.log(clusterInfo);

        // Bulk write to an ES Index
        // TODO CLEAN UP ALL CODE AFTER THIS BLOCK
        // await client.indices.create({
        //     index: process.env.ES_INDEX,
        //     body: {
        //         mappings: {
        //             properties: {
        //                 ip: {type: 'text'},
        //             }
        //         }
        //     }
        // }, {ignore: [400]})
        //
        // const response = await writeToES(process.env.ES_INDEX, aggregateIps);
        //
        // console.log(response);

        return createResponse(200, 'ok');
    } catch (e) {
        return createResponse(503, e.message);
    }
};

