// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://aws.amazon.com/developers/getting-started/nodejs/

// Load the AWS SDK
const AWS = require('aws-sdk');
const region = "eu-west-1";
const secretName = "ES_ENDPOINT";

// Create a Secrets Manager client
const client = new AWS.SecretsManager({
    region: region
});

export async function getESEndpoint() {
    
    const secret = await client.getSecretValue({SecretId: secretName}).promise();
    const secretJSON = JSON.parse(secret.SecretString);
    const endpoint = secretJSON[secretName];

    return endpoint;
}


