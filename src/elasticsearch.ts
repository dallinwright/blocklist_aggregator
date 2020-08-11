import {ESEntry} from "./interfaces/ESEntry";
import {ESError} from "./interfaces/ESError";

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

export async function createIndex() {
    if (!process.env.ES_INDEX) {
        throw new Error('Index provided to create is undefined');
    }

    // Test and establish Elasticsearch connection
    console.log('Attempting to connect to elasticsearch');
    const clusterInfo = await client.info();
    console.log(clusterInfo);

    return client.indices.create({
        index: process.env.ES_INDEX,
        body: {
            mappings: {
                properties: {
                    ip: {type: 'text'},
                }
            }
        }
    }, {ignore: [400]});
}

export async function bulkWriteToES(ips: Set<string>) {
    if (!process.env.ES_INDEX) {
        throw new Error('Provided index to bulk write is undefined');
    }

    console.log('Beginning ES bulk write');
    const ipArr: string[] = [...ips];
    const chunkSize = 25;

    for (let i = 0; i < 25; i += chunkSize) {
        // for (let i = 0; i < ipArr.length; i += chunkSize) {
        const chunk = ipArr.slice(i, i + chunkSize);
        const esItems: ESEntry[] = [];

        for (const ip of chunk) {
            const body: ESEntry = {
                "ip": ip
            }

            esItems.push(body);
        }

        const body = esItems.flatMap((doc: any) => [{index: {_index: process.env.ES_INDEX}}, doc]);

        const {body: bulkResponse} = await client.bulk({refresh: true, body})

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
