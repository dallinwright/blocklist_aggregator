import {cloneRepo, getMatchingFiles} from "../src";
import {expect} from 'chai';
import chai = require('chai');

chai.use(require('chai-as-promised'))

describe('Lambda Handler Tests', () => { // the tests container
    describe('Repo Clone', () => {
        it('Should not clone an undefined repo', async () => {
            await expect(cloneRepo()).to.be.rejectedWith(Error)
        })

        it('Should clone a given repo, even if it already exists', async () => {
            process.env.BASE_REPO = 'https://github.com/dallinwright/blocklist_aggregator.git';
            await expect(await cloneRepo()).to.eq('blocklist_aggregator');
        }).timeout(20000);
    });

    describe('Get matching files', () => {
        it('Should return a list of files matching the path and match pattern', async () => {
            const path = 'blocklist_aggregator/tests';
            process.env.BLOCK_LISTS = "test.ipset";
            const matchingFiles = getMatchingFiles(path);
            expect(matchingFiles).to.be.a('set');
        })
    });
});
