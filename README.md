# Blocklist Aggregator

![Deploy](https://github.com/dallinwright/blocklist_aggregator/workflows/Deploy/badge.svg)

The scope of this serverless application is to create a service that can determine whether an IP address is allowed or not based on this source: https://github.com/firehol/blocklist-ipsets.

Self-update whenever there are new entries in https://github.com/firehol/blocklist-ipsets. No human intervention is required.

### Overview

The service runs in AWS and uses the AWS managed elasticsearch service to store every ip you wish to block. The service works by taking a github repository you provide, cloning the repo, finding the blocklists you specify, then parsing them for IP's. It supports IP Ranges well as single IP addresses, in the format of an ip address/range per line.

### Instructions

The service executes as an AWS Lambda and can be configured via environment variables.

```yaml
ES_REGION: eu-west-1
ES_ENDPOINT: https://vpc-my-endpoint.eu-west-1.es.amazonaws.com
ES_INDEX: blocklist
BASE_REPO: https://github.com/firehol/blocklist-ipsets.git
BLOCK_LISTS: "blocklist*.ipset,dshield*.ipset,zeus*.ipset,dshield*.netset"
```

### License
TBD

### Contributing

TBD
