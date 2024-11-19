import { toNano, beginCell } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const itemCode = await compile('NftItem');
    const collectionContent = "https://minsk-bootcamp-sbt.s3.us-east-2.amazonaws.com/october24/bootcamp_meta.json";
    const commonContent = "https://minsk-bootcamp-sbt.s3.us-east-2.amazonaws.com/october24";
    
    const collection = provider.open(
        NftCollection.createFromConfig({
            ownerAddress: provider.sender().address!,
            nextItemIndex: 0,
            collectionContent,
            commonContent,
            nftItemCode: itemCode,
            royaltyParams: {
                factor: 100,  // 10%
                base: 1000,
                address: provider.sender().address!,
            },
            mintPrice: toNano('0.1'),
            maxSupply: 1000,
            endTime: Math.floor(Date.now() / 1000) + 864000, // 24 hours from now
            refundPercent: 5000, // 50%
            ticketsSold: 0,
        }, await compile('NftCollection'))
    );

    await collection.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(collection.address);
    
    console.log('NFT Collection deployed at:', collection.address.toString());
}