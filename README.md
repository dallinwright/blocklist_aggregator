# Blocklist Aggregator

![Deploy](https://github.com/dallinwright/blocklist_aggregator/workflows/Deploy/badge.svg)

![Lint and Test](https://github.com/dallinwright/blocklist_api/workflows/Lint%20and%20Test/badge.svg)

The scope of this serverless application is to create a service that can determine whether an IP address is allowed or not based on this source: https://github.com/firehol/blocklist-ipsets.

Self-updates whenever there are new entries in https://github.com/firehol/blocklist-ipsets (Updates occur once every 24 hours exactly, hence the usage of the cronjob trigger via cloudwatch).

### Overview

The service runs in AWS and uses the AWS managed elasticsearch service to store every ip you wish to block. The service works by taking a github repository you provide, cloning the repo, finding the blocklists you specify, then parsing them for IP's. 

### Features
##### Single IP address IPSET support

It supports IP Ranges well as single IP addresses, in the format of an ip address/range per line.

##### Netset support
Can also parse input for a subnet rank, simply by supplying the subnet mask suffix

##### Wildcard filename matching
Can specify filenames by path and wildcard, for example `dshield*.ipset` will use this regex to match the files starting with `dshield` and ending with the `.ipset` file suffix.


### Instructions
The service executes as an AWS Lambda and can be configured via environment variables in the `severless.yml` file. The exception is the elasticsearch endpoint URL, it must be stored in AWS Secret Manager. Typically, you would be fine to use an environment variable but in a public repo, it is not a good idea to publish infrastructure detail to that extent.

##### Example values for `serverless.yaml` environment config
Here are the available options you can configure, the `BLOCK_LISTS` is an environment variable configured as relative paths inside the repo you wish to use as the `BASE_REPO` env var.
```yaml
  environment:
    ES_REGION: eu-west-1
    ES_INDEX: blocklist
    BASE_REPO: https://github.com/firehol/blocklist-ipsets.git
    BLOCK_LISTS: "blocklist*.ipset,dshield*.ipset,zeus*.ipset,dshield*.netset"
```


##### Successful Lambda execution example 8-11-2020
![Part 1 success](./screenshots/cw.png?raw=true)

##### Successful second lambda execution triggered via Cloudwatch 8-14-2020
![Part 1 success](./screenshots/working-cron.png?raw=true)


### Extending

This is all well and good for an "alpha" phase of the product, there are areas where it could be improved and polished. 

##### Canary Deployment
Currently, this is set up in a blue-green deployment model which carries added risk should an outage occur or a problem during deployment. All the users would be effected at once.

You have a few options to mitigate this, via this serverless [Canary Deployment plugin](https://www.serverless.com/blog/manage-canary-deployments-lambda-functions-serverless-framework), using Route53 weighted aliases, canary deployment configuration via API Gateway, or using container specific strategies such as the technology Istio for Kubernetes.

##### Alerting
Alerting should be in place for production systems. We have monitoring for base Lambda metrics such as error rate, count, latency, etc. but an added option would be to enable alerting in Cloudwatch to an SNS topic to fire alerts if these go outside established boundaries. This can be configured via serverless in the [AWS Alerts Plugin](https://www.serverless.com/plugins/serverless-plugin-aws-alerts).

##### Testing

We have some minimal unit tests, but we are missing integration and e2e tests as well as code security analysis via tools like sonarqube among other things. Having these would increase code quality and decrease smells as the project evolves and grows. We do however use [Dependabot](https://dependabot.com/) to automate PR creation when dependent NPM packages have new releases which helps significantly.
