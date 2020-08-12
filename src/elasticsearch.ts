import {ESEntry} from "./interfaces/ESEntry";
import {ESError} from "./interfaces/ESError";

const AWS = require('aws-sdk');
const {Client} = require('@elastic/elasticsearch');

export function initializeESClient(esEndpoint: string): any {
    /**
     * initialize the client connection to the provided es endpoint
     * @function initializeESClient
     * @public
     * @param {string} elasticsearch endpoint
     * @return {any} A success or error api-gateway compatible response.
     */
    if (AWS && AWS.config && AWS.config.credentials) {
        const accessKeyId = AWS.config.credentials.accessKeyId;
        const secretAccessKey = AWS.config.credentials.secretAccessKey;

        return new Client({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            service: 'es',
            region: process.env.ES_REGION,
            node: esEndpoint
        });
    } else {
        throw new Error('Could not initialize AWS ES client');
    }
}

export function buildIndexName(date: Date): string {
    /**
     * initialize the client connection to the provided es endpoint
     * @function initializeESClient
     * @public
     * @param {Date} date to construct index name with
     * @return {any} index name with date in yyyy-mm-dd
     */
    const prettyDate = date.getFullYear().toString() + "-" +
        ((date.getMonth() + 1).toString().length == 2 ? (date.getMonth() + 1).toString() : "0" +
            (date.getMonth() + 1).toString()) + "-" +
        (date.getDate().toString().length == 2 ? date.getDate().toString() : "0" +
            date.getDate().toString());

    return process.env.ES_INDEX + '-' + prettyDate;
}

export async function createIndex(esClient: any, index: string): Promise<any> {
    /**
     * Create elasticsearch index using the supplied anv var, followed by today's date in ISO format yyyy-mm-dd
     * @function createIndex
     * @public
     * @return {any} response from es create index
     */
    if (!process.env.ES_INDEX) {
        throw new Error('Index provided to create is undefined');
    }

    // Test and establish Elasticsearch connection
    console.log('Attempting to connect to elasticsearch');
    const clusterInfo = await esClient.info();
    console.log(clusterInfo);

    // Delete index if it exists and recreate.
    await deleteIndex(esClient, index);

    console.log('Creating index: ' + index);

    return esClient.indices.create({
        index: index,
        body: {
            mappings: {
                properties: {
                    ip: {type: 'text'},
                }
            }
        }
    }, {ignore: [400]});
}

export async function deleteIndex(esClient: any, index: string): Promise<any> {
    /**
     * Create elasticsearch index using the supplied anv var, followed by yesterdays's date in ISO format yyyy-mm-dd
     * @function deleteIndex
     * @public
     * @return {any} response from es create index
     */
    if (!process.env.ES_INDEX) {
        throw new Error('Index provided to create is undefined');
    }

    console.log('Deleting index: ' + index);

    return esClient.indices.delete({
        index: index,
    }, {ignore: [400]});
}

export async function bulkWriteToES(esClient: any, ips: Set<string>): Promise<any> {
    /**
     * Bulk write our ip's to ES, in chunks.
     * @function bulkWriteToES
     * @public
     * @return {any} response from es create index
     */
    if (!process.env.ES_INDEX) {
        throw new Error('Provided index to bulk write is undefined');
    }

    console.log('Beginning ES bulk write');
    const ipArr: string[] = [...ips];
    const chunkSize = 25;

    for (let i = 0; i < ipArr.length; i += chunkSize) {
        const chunk = ipArr.slice(i, i + chunkSize);
        const esItems: ESEntry[] = [];

        for (const ip of chunk) {
            const body: ESEntry = {
                "ip": ip
            }

            esItems.push(body);
        }

        const body = esItems.flatMap((doc: any) => [{index: {_index: process.env.ES_INDEX}}, doc]);

        const {body: bulkResponse} = await esClient.bulk({refresh: true, body})

        if (bulkResponse.errors) {
            const erroredDocuments: ESError[] = []
            // The items array has the same order of the dataset we just indexed.
            // The presence of the `error` key indicates that the operation
            // that we did for the document has failed.
            bulkResponse.items.forEach((action: {
                [x: string]: {
                    status: any;
                    error: any;
                };
            }, i: number) => {
                const operation = Object.keys(action)[0]
                if (action[operation].error) {
                    erroredDocuments.push({
                        // If the status is 429 it means that you can retry the document,
                        // otherwise it's very likely a mapping error, and you should
                        // fix the document before to try it again.
                        status: action[operation].status,
                        error: action[operation].error,
                        operation: body[i * 2],
                        document: body[i * 2 + 1]
                    })
                }
            })
            console.log(erroredDocuments);
            throw new Error(erroredDocuments.toString());
        }

        console.log('Successfully wrote batch ' + i + ' through ' + (i + chunkSize));
    }

    return 'success';
}
