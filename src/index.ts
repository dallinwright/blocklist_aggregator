import {APIGatewayProxyResultV2, Handler} from 'aws-lambda';
import {getESEndpoint} from "./secretManager";
import {buildIndexName, bulkWriteToES, createIndex, deleteIndex, initializeESClient} from "./elasticsearch";

// Javascript style imports, as they do not have typescript typedefs
const fs = require("fs");
const readline = require('readline');
const glob = require("glob");
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const getIPRange = require('get-ip-range');

export function createResponse(statusCode: number, body: any): APIGatewayProxyResultV2 {
    /**
     * Create API Gateway formatted response, useful even if not using api gateway
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

export async function cloneRepo(): Promise<string> {
    /**
     * Clone a given repo to the lambda writable /tmp directory
     * @function cloneRepo
     * @public
     * @return {string} directory name of newly cloned repo
     */
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

export function getMatchingFiles(clonedPath: string): Set<string> {
    /**
     * Takes a list of files in string format, and returns all matching files. Supports wildcard matching.
     * @function cloneRepo
     * @public
     * @return {string[]} Array of matching files.
     */
    console.log('Beginning to search for matching files');
    let matchingFiles: Set<string> = new Set<string>();

    if (!process.env.BLOCK_LISTS) {
        throw new Error("No block list given");
    }

    const list = process.env.BLOCK_LISTS;

    if (list) {
        const fileList = list.split(',');

        for (const item of fileList) {
            const file = glob.sync('/tmp/' + clonedPath + '/' + item);
            matchingFiles = matchingFiles.add(file);
        }
    }

    console.log('Matching files complete with list');
    console.log(matchingFiles);
    return matchingFiles;
}

export async function getAggregateIPS(files: string[]): Promise<Set<string>> {
    /**
     * Combined ips from across all files into a unique set
     * @function getAggregateIPS
     * @public
     * @param  {string[]} array of filenames
     * @return {Promise<Set<string>>} A set of ips in an async format
     */
    console.log('Beginning to aggregate unique set of ips from across files');
    const ipSet: Set<string> = new Set();

    // Take all entries that aren't comments
    for (const file of files) {
        const rd = readline.createInterface({
            input: fs.createReadStream(file, 'utf8'),
            output: process.stdout,
            terminal: false,
        });

        for await (const line of rd) {
            if (!line.startsWith('#')) {
                // Logic to convert ip ranges to ips, if given entry is not already an ip
                if (line.includes('/')) {
                    const ipArr = getIPRange(line);

                    for (const ip of ipArr) {
                        ipSet.add(ip);
                    }
                } else {
                    ipSet.add(line);
                }
            }
        }
    }

    console.log('Aggregate complete.')
    return ipSet;
}

export const handler: Handler = async () => {
    /**
     * AWS Lambda handler
     * @function handler
     * @public
     * @return {any} A success or error api-gateway compatible response.
     */
    console.log('Beginning aggregator execution');

    try {
        // Build our data structure of IP's based upon the daily repo update
        const clonedPath: string = await cloneRepo();
        const matchingFiles: Set<string> = getMatchingFiles(clonedPath);

        // Using array expansion, this converts our set of unique items to an iterable array.
        // Get a full list of unique IP's across unique filenames
        const items: string[] = [...matchingFiles].flat();
        const aggregateIps: Set<string> = await getAggregateIPS(items);

        console.log('Total IPs to Block: ' + aggregateIps.size);

        // Decrypt and pull secret containing ES_ENDPOINT. To abstract and not store specifics in a public repo.
        // and then initialize the ES client connection.
        const esEndpoint = await getESEndpoint();
        const esClient = initializeESClient(esEndpoint);

        // Create today's index
        const today = new Date();
        const indexToday = buildIndexName(today);
        await createIndex(esClient, indexToday);

        // Bulk write to ES
        const response = await bulkWriteToES(esClient, indexToday, aggregateIps);

        // If successful (it would error before here) delete the previous days index
        const yesterday = (d => new Date(d.setDate(d.getDate() - 1)))(new Date);
        const indexYesterday = buildIndexName(yesterday);
        await deleteIndex(esClient, indexYesterday);

        return createResponse(200, response);
    } catch (e) {
        return createResponse(503, e.message);
    }
};

