import {APIGatewayProxyResultV2, Callback, Context, Handler} from 'aws-lambda';

// Javascript style imports, as they do not have typescript typedefs
// const fs = require("fs");
// const readline = require('readline');
const glob = require("glob")
const shell = require('shelljs')

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
        const gitPath = repo.slice(repo.lastIndexOf('/') + 1);
        const path = gitPath.slice(0, gitPath.lastIndexOf('.'));

        shell.rm('-rf', path);
        shell.exec(`git clone ${repo}`);

        if (shell.error()) {
            throw new Error(shell.error());
        }

        return path;
    } else {
        throw new Error("No repo given for ip blacklist baseline");
    }
}

function getMatchingFiles(list: string | undefined, clonedPath: string): string[] {
    let matchingFiles: string[] = [];

    if (list) {
        const fileList = list.split(',');

        for (const file of fileList) {
            const files = glob.sync(clonedPath + '/' + file);
            matchingFiles = matchingFiles.concat(files);
        }
    }

    return matchingFiles;
}

//
// async function getAggregateIPS(files: string[]): Promise<Set<string>> {
//     const ipSet: Set<string> = new Set();
//
//     for (const file of files) {
//         const rd = readline.createInterface({
//             input: fs.createReadStream(file, 'utf8'),
//             output: process.stdout,
//             terminal: false,
//         });
//
//         for await (const line of rd) {
//             if (!line.startsWith('#')) {
//                 ipSet.add(line)
//             }
//         }
//     }
//
//     return ipSet;
// }

// async function writeToDynamoDB(tableName: string | undefined, ips: Set<string>) {
//     if (tableName) {
//         const ipArr = [...ips];
//         const chunkSize = 25;
//
//         for (let i = 0; i < ipArr.length; i += chunkSize) {
//             const chunk = ipArr.slice(i, i + chunkSize);
//             const requestArr = [];
//
//             for (const ip of chunk) {
//                 const requestBody = {
//                     PutRequest: {
//                         Item: {
//                             "IP": ip
//                         }
//                     }
//                 }
//
//                 requestArr.push(requestBody);
//             }
//
//             const params = {
//                 RequestItems: {
//                     [tableName]: [
//                         ...requestArr
//                     ]
//                 }
//             }
//
//             await ddb.batchWrite(params).promise();
//             console.log('Successfully wrote batch ' + i + ' through ' + (i + chunkSize));
//         }
//
//         return 'success';
//     } else {
//         throw new Error("No table name provided");
//     }
// }


export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    try {
        const clonedPath: string = await cloneRepo(process.env.BASE_REPO);
        const matchingFiles: string[] = getMatchingFiles(process.env.BLOCK_LISTS, clonedPath);
        console.log(matchingFiles);
        const clusterInfo = await client.info();
        console.log(clusterInfo);


        return createResponse(200, 'ok');
    } catch (e) {
        return createResponse(503, e.message);
    }
};

