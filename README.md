# Blocklist Aggregator

![Deploy](https://github.com/dallinwright/blocklist_aggregator/workflows/Deploy/badge.svg)

The scope of this serverless application is to create a service that can determine whether an IP address is allowed or not based on this source: https://github.com/firehol/blocklist-ipsets.

Self-update whenever there are new entries in https://github.com/firehol/blocklist-ipsets. No human intervention is required.

### Overview

The service runs in AWS and uses the AWS managed elasticsearch service to store every ip you wish to block. The service works by taking a github repository you provide, cloning the repo, finding the blocklists you specify, then parsing them for IP's. It supports IP Ranges well as single IP addresses, in the format of an ip address/range per line.

### Instructions

The service executes as an AWS Lambda and can be configured via environment variables in the `severless.yml` file. The exception is the elasticsearch endpoint URL, it must be stored in AWS Secret Manager. Typically, you would be fine to use an environment variable but in a public repo, it is not a good idea to publish infrastructure detail to that extent.


##### Successful Lambda execution example

![Part 1 success](./screenshots/cw.png?raw=true)


##### Examples of how it could be expanded to support canary deployment, alerting, etc.

Canary Deployment plugin
https://www.serverless.com/blog/manage-canary-deployments-lambda-functions-serverless-framework

Cloudwatch alerts
https://www.serverless.com/plugins/serverless-plugin-aws-alerts
