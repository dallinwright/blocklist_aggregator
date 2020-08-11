import {cloneRepo} from "../src";
import {expect} from 'chai';
import chai = require('chai');

chai.use(require('chai-as-promised'))

describe('Lambda Handler Tests', () => { // the tests container
    describe('Repo Clone', () => {
        it('Should not clone an undefined repo', async () => {
            await expect(cloneRepo(undefined)).to.be.rejectedWith(Error)
        })

        it('Should clone a given repo, even if it already exists', async () => {
            const repo = 'https://github.com/dallinwright/blocklist_aggregator.git';
            await expect(await cloneRepo(repo)).to.eq('blocklist_aggregator');
        }).timeout(10000);
    });
});
