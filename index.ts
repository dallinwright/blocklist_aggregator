import { Handler, Context, Callback } from 'aws-lambda';

interface APIResponse {
    statusCode: number;
    body: string;
    headers: any;
}

const createResponse = (statusCode: number, body: any) => ({
    statusCode: statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
});


const handler: Handler = async (event: any, context: Context, callback: Callback) => {
    const response: APIResponse = createResponse(200, event);

    callback(undefined, response);
};

export { handler }
